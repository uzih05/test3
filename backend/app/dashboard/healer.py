"""
Healer Service

Provides AI-powered bug diagnosis and fix suggestions.
Self-contained implementation replacing vectorwave SDK's VectorWaveHealer.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

import weaviate
from app.core.config import settings
from app.core.llm_client import get_llm_client, LLMClient
from app.core.weaviate_adapter import (
    search_executions, find_executions,
)

import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate

logger = logging.getLogger(__name__)


class HealerService:
    """
    Provides AI-powered healing functionality for the dashboard.
    """

    def __init__(self, client: weaviate.WeaviateClient, model: str = "gpt-4o-mini",
                 connection_type: str = "self_hosted",
                 openai_api_key: str | None = None):
        self.client = client
        self.settings = settings
        self.model = model
        self.connection_type = connection_type
        self.openai_api_key = openai_api_key

    def _get_execution_collection(self):
        """Returns the execution collection for aggregate queries."""
        return self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

    def diagnose_and_heal(
            self,
            function_name: str,
            lookback_minutes: int = 60,
            openai_api_key: str | None = None,
    ) -> Dict[str, Any]:
        """
        Diagnoses errors for a function and suggests fixes.
        """
        try:
            llm = get_llm_client(openai_api_key)
            if not llm:
                return {
                    "function_name": function_name,
                    "diagnosis": "OpenAI API key not configured. Please set your API key in Settings.",
                    "suggested_fix": None,
                    "lookback_minutes": lookback_minutes,
                    "status": "error"
                }

            # 1. Retrieve function by exact name (no vectorizer needed)
            func_col = self.client.collections.get(settings.COLLECTION_NAME)
            func_result = func_col.query.fetch_objects(
                filters=wvc_query.Filter.by_property("function_name").equal(function_name),
                limit=1,
            )
            if not func_result.objects:
                return {
                    "function_name": function_name,
                    "diagnosis": f"Function definition not found: {function_name}",
                    "suggested_fix": None,
                    "lookback_minutes": lookback_minutes,
                    "status": "error"
                }

            source_code = func_result.objects[0].properties.get('source_code', '')
            if not source_code:
                return {
                    "function_name": function_name,
                    "diagnosis": "No stored source code found.",
                    "suggested_fix": None,
                    "lookback_minutes": lookback_minutes,
                    "status": "error"
                }

            # 2. Collect recent error logs
            time_limit = (datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)).isoformat()
            error_logs = find_executions(
                self.client,
                filters={
                    "function_name": function_name,
                    "status": "ERROR",
                    "timestamp_utc__gte": time_limit
                },
                limit=3,
                sort_by="timestamp_utc",
                sort_ascending=False
            )

            if not error_logs:
                return {
                    "function_name": function_name,
                    "diagnosis": f"No errors found for '{function_name}' in the last {lookback_minutes} minutes.",
                    "suggested_fix": None,
                    "lookback_minutes": lookback_minutes,
                    "status": "no_errors"
                }

            # 3. Collect success logs for reference
            success_logs = find_executions(
                self.client,
                filters={
                    "function_name": function_name,
                    "status": "SUCCESS"
                },
                limit=2,
                sort_by="timestamp_utc",
                sort_ascending=False
            )

            # 4. Construct prompt
            prompt_context = self._construct_prompt(
                function_name, source_code, error_logs, success_logs, lookback_minutes
            )

            # 5. Call LLM
            result = llm.chat(
                messages=[
                    {"role": "system", "content": "You are an expert Python debugger."
                                                  " Analyze the code and errors provided,"
                                                  " then generate a fixed version of the code."},
                    {"role": "user", "content": prompt_context}
                ],
                model=self.model,
                temperature=0.1
            )

            if not result:
                return {
                    "function_name": function_name,
                    "diagnosis": "LLM returned no response.",
                    "suggested_fix": None,
                    "lookback_minutes": lookback_minutes,
                    "status": "error"
                }

            return {
                "function_name": function_name,
                "diagnosis": "Analysis complete. See suggested fix.",
                "suggested_fix": result,
                "lookback_minutes": lookback_minutes,
                "status": "success"
            }

        except Exception as e:
            logger.error(f"Failed to diagnose {function_name}: {e}")
            return {
                "function_name": function_name,
                "diagnosis": f"Diagnosis failed: {str(e)}",
                "suggested_fix": None,
                "lookback_minutes": lookback_minutes,
                "status": "error",
                "error": str(e)
            }

    def _construct_prompt(self, func_name, source_code, errors, successes, lookback_minutes) -> str:
        """Construct debugging prompt for LLM."""
        error_details = []
        for err in errors:
            inputs = {k: v for k, v in err.items()
                      if k not in ['trace_id', 'span_id', 'error_message', 'source_code', 'return_value']}
            error_details.append(f"""
- Timestamp: {err.get('timestamp_utc')}
- Error Code: {err.get('error_code')}
- Error Message: {err.get('error_message')}
- Inputs causing error: {json.dumps(inputs, default=str)}
            """)

        success_details = []
        for suc in successes:
            inputs = {k: v for k, v in suc.items()
                      if k not in ['trace_id', 'span_id', 'return_value']}
            output = suc.get('return_value')
            success_details.append(f"""
- Inputs: {json.dumps(inputs, default=str)}
- Output: {output}
            """)

        prompt = fr'''
# Debugging Task for Function: `{func_name}`

## 1. Context
You are an expert Python debugger. Your goal is to fix a buggy function based on its source code and execution logs.

## 2. Current Source Code
(Note: The code below may contain decorators like @vectorize, which should NOT be included in your output.)
\`\`\`python
{source_code}
\`\`\`

## 3. Recent Errors (last {lookback_minutes} minutes)
{''.join(error_details)}

## 4. Successful Executions (Reference)
{''.join(success_details) if success_details else "No success logs available."}

## 5. Instructions
1. **Analyze**: Infer the intended functionality of `{func_name}` based on its name and current logic.
2. **Diagnose**: Identify the root cause of the "Recent Errors".
3. **Fix**: Rewrite the function so that it returns correct results for ALL inputs, including those that previously caused errors.
    - Fix the root logic itself. DO NOT simply add defensive `raise` statements or wrap code in `try/except` as a workaround.
    - Use the "Successful Executions" above to infer the expected input→output pattern, then ensure error-causing inputs also produce valid results following that same pattern.
    - If the code contains clearly incorrect logic (like intentional bug injections for testing), correct it to match the intended behavior.
    - Refactor the code to be clean and idiomatic Python.
4. **Constraint**:
    - Return **ONLY** the full, corrected function definition.
    - Start exactly with `def {func_name}(...):`.
    - **DO NOT** include the `@vectorize` decorator or any other decorators in the output.
    - **DO NOT** include any markdown formatting (like ```python), comments outside the function, or explanations.
'''
        return prompt

    def get_healable_functions(
            self,
            time_range_minutes: int = 1440
    ) -> Dict[str, Any]:
        """
        Returns functions that have recent errors and are candidates for healing.
        """
        try:
            collection = self._get_execution_collection()

            base_filter = wvc_query.Filter.by_property("status").equal("ERROR")

            if time_range_minutes > 0:
                time_limit = (datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes))
                base_filter = base_filter & wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(time_limit)

            func_result = collection.aggregate.over_all(
                filters=base_filter,
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True
            )

            func_error_counts: Dict[str, int] = {}
            for group in func_result.groups:
                func_name = group.grouped_by.value
                if func_name:
                    func_error_counts[func_name] = group.total_count or 0

            items = []

            for func_name, error_count in func_error_counts.items():
                func_filter = base_filter & wvc_query.Filter.by_property("function_name").equal(func_name)

                code_result = collection.aggregate.over_all(
                    filters=func_filter,
                    group_by=GroupByAggregate(prop="error_code"),
                    total_count=True
                )

                error_codes = set()
                for group in code_result.groups:
                    code = group.grouped_by.value
                    if code:
                        error_codes.add(code)

                latest_errors = search_executions(
                    self.client,
                    limit=1,
                    filters={
                        "function_name": func_name,
                        "status": "ERROR"
                    },
                    sort_by="timestamp_utc",
                    sort_ascending=False
                )

                latest_time = None
                if latest_errors:
                    latest_time = latest_errors[0].get('timestamp_utc')

                items.append({
                    "function_name": func_name,
                    "error_count": error_count,
                    "error_codes": list(error_codes),
                    "latest_error_time": latest_time
                })

            items.sort(key=lambda x: x["error_count"], reverse=True)

            return {
                "items": items,
                "total": len(items),
                "time_range_minutes": time_range_minutes
            }

        except Exception as e:
            logger.error(f"Failed to get healable functions: {e}")
            return {
                "items": [],
                "total": 0,
                "time_range_minutes": time_range_minutes,
                "error": str(e)
            }

    def batch_diagnose(
            self,
            function_names: List[str],
            lookback_minutes: int = 60,
            openai_api_key: str | None = None,
    ) -> Dict[str, Any]:
        """
        Diagnoses multiple functions in batch (synchronous version).
        """
        results = []
        succeeded = 0
        failed = 0

        for func_name in function_names:
            try:
                diagnosis_result = self.diagnose_and_heal(
                    function_name=func_name,
                    lookback_minutes=lookback_minutes,
                    openai_api_key=openai_api_key,
                )

                results.append({
                    "function_name": func_name,
                    "status": diagnosis_result["status"],
                    "diagnosis_preview": (diagnosis_result.get("diagnosis", "")[:200] + "...")
                    if diagnosis_result.get("diagnosis") else ""
                })

                if diagnosis_result["status"] in ["success", "no_errors"]:
                    succeeded += 1
                else:
                    failed += 1

            except Exception as e:
                logger.error(f"Batch diagnosis failed for {func_name}: {e}")
                results.append({
                    "function_name": func_name,
                    "status": "error",
                    "diagnosis_preview": str(e)
                })
                failed += 1

        return {
            "results": results,
            "total": len(function_names),
            "succeeded": succeeded,
            "failed": failed
        }

    async def batch_diagnose_async(
            self,
            function_names: List[str],
            lookback_minutes: int = 60,
            max_concurrent: int = 3,
            timeout_seconds: int = 60,
            openai_api_key: str | None = None,
    ) -> Dict[str, Any]:
        """
        Diagnoses multiple functions in batch with async parallel processing.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        semaphore = asyncio.Semaphore(max_concurrent)
        executor = ThreadPoolExecutor(max_workers=max_concurrent)

        async def diagnose_with_limit(func_name: str) -> Dict[str, Any]:
            async with semaphore:
                try:
                    loop = asyncio.get_event_loop()
                    diagnosis_result = await asyncio.wait_for(
                        loop.run_in_executor(
                            executor,
                            lambda: self.diagnose_and_heal(
                                function_name=func_name,
                                lookback_minutes=lookback_minutes,
                                openai_api_key=openai_api_key,
                            )
                        ),
                        timeout=timeout_seconds
                    )

                    return {
                        "function_name": func_name,
                        "status": diagnosis_result["status"],
                        "diagnosis": diagnosis_result.get("diagnosis", ""),
                        "suggested_fix": diagnosis_result.get("suggested_fix"),
                        "diagnosis_preview": (diagnosis_result.get("diagnosis", "")[:200] + "...")
                        if diagnosis_result.get("diagnosis") else ""
                    }

                except asyncio.TimeoutError:
                    logger.warning(f"Diagnosis timeout for {func_name} after {timeout_seconds}s")
                    return {
                        "function_name": func_name,
                        "status": "error",
                        "diagnosis": f"Diagnosis timed out after {timeout_seconds} seconds",
                        "diagnosis_preview": f"Timeout after {timeout_seconds}s"
                    }
                except Exception as e:
                    logger.error(f"Batch diagnosis failed for {func_name}: {e}")
                    return {
                        "function_name": func_name,
                        "status": "error",
                        "diagnosis": str(e),
                        "diagnosis_preview": str(e)[:200]
                    }

        try:
            tasks = [diagnose_with_limit(fn) for fn in function_names]
            results = await asyncio.gather(*tasks, return_exceptions=False)

            succeeded = sum(1 for r in results if r["status"] in ["success", "no_errors"])
            failed = len(results) - succeeded

            return {
                "results": results,
                "total": len(function_names),
                "succeeded": succeeded,
                "failed": failed
            }

        finally:
            executor.shutdown(wait=False)
