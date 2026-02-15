"""
Ask AI Service

Comprehensive AI Q&A service that answers questions using
the user's Weaviate data (functions, executions, errors) as context.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

import weaviate
import weaviate.classes.query as wvc_query
from app.core.config import settings
from app.core.llm_client import get_llm_client
from app.core.weaviate_adapter import find_executions

logger = logging.getLogger(__name__)


class AskAiService:
    """AI Q&A service powered by user's monitoring data."""

    def __init__(self, client: weaviate.WeaviateClient, openai_api_key: str | None = None):
        self.client = client
        self.openai_api_key = openai_api_key
        self.model = "gpt-4o-mini"

    def ask(self, question: str, function_name: str | None = None) -> Dict[str, Any]:
        """Answer a question using Weaviate data as context."""
        try:
            llm = get_llm_client(self.openai_api_key)
            if not llm:
                return {
                    "question": question,
                    "answer": "OpenAI API key not configured. Please set your API key in Settings.",
                    "function_name": function_name,
                    "source_type": "ask_ai",
                    "status": "error",
                }

            context = self._build_context(function_name)

            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are an AI assistant for VectorSurfer, a function monitoring dashboard. "
                        "Answer the user's question based on the provided monitoring data. "
                        "Be specific — reference actual function names, error messages, and metrics from the data. "
                        "If the data doesn't contain enough information to answer, say so clearly. "
                        "Answer in the same language as the user's question."
                    ),
                },
                {
                    "role": "user",
                    "content": f"## Monitoring Data\n\n{context}\n\n## Question\n\n{question}",
                },
            ]

            result = llm.chat(messages=messages, model=self.model, temperature=0.3)

            if not result:
                return {
                    "question": question,
                    "answer": "AI returned no response. Please try again.",
                    "function_name": function_name,
                    "source_type": "ask_ai",
                    "status": "error",
                }

            return {
                "question": question,
                "answer": result,
                "function_name": function_name,
                "source_type": "ask_ai",
                "status": "success",
            }

        except Exception as e:
            logger.error(f"Ask AI failed: {e}")
            return {
                "question": question,
                "answer": f"Failed to process question: {str(e)}",
                "function_name": function_name,
                "source_type": "ask_ai",
                "status": "error",
            }

    def _build_context(self, function_name: str | None = None) -> str:
        """Gather relevant data from Weaviate to build LLM context."""
        if function_name:
            return self._build_function_context(function_name)
        return self._build_general_context()

    def _build_function_context(self, function_name: str) -> str:
        """Build context for a specific function."""
        parts = []

        # 1. Function definition
        try:
            func_col = self.client.collections.get(settings.COLLECTION_NAME)
            func_result = func_col.query.fetch_objects(
                filters=wvc_query.Filter.by_property("function_name").equal(function_name),
                limit=1,
            )
            if func_result.objects:
                props = func_result.objects[0].properties
                parts.append(f"### Function: {function_name}")
                if props.get("source_code"):
                    parts.append(f"```python\n{props['source_code']}\n```")
                if props.get("module_name"):
                    parts.append(f"Module: {props['module_name']}")
            else:
                parts.append(f"### Function: {function_name} (definition not found)")
        except Exception as e:
            logger.warning(f"Failed to fetch function definition: {e}")

        # 2. Recent executions
        try:
            recent = find_executions(
                self.client,
                filters={"function_name": function_name},
                limit=20,
                sort_by="timestamp_utc",
                sort_ascending=False,
            )
            if recent:
                success_count = sum(1 for e in recent if e.get("status") == "SUCCESS")
                error_count = sum(1 for e in recent if e.get("status") == "ERROR")
                cache_count = sum(1 for e in recent if e.get("status") == "CACHE_HIT")
                durations = [e.get("duration_ms", 0) for e in recent if e.get("duration_ms")]
                avg_duration = sum(durations) / len(durations) if durations else 0

                parts.append(f"\n### Recent Executions (last {len(recent)})")
                parts.append(f"- Success: {success_count}, Error: {error_count}, Cache Hit: {cache_count}")
                parts.append(f"- Avg Duration: {avg_duration:.1f}ms")
        except Exception as e:
            logger.warning(f"Failed to fetch recent executions: {e}")

        # 3. Recent errors
        try:
            errors = find_executions(
                self.client,
                filters={"function_name": function_name, "status": "ERROR"},
                limit=10,
                sort_by="timestamp_utc",
                sort_ascending=False,
            )
            if errors:
                parts.append(f"\n### Recent Errors ({len(errors)})")
                for err in errors[:5]:
                    parts.append(
                        f"- [{err.get('error_code', 'N/A')}] {err.get('error_message', 'N/A')}"
                        f" (at {err.get('timestamp_utc', 'N/A')})"
                    )
        except Exception as e:
            logger.warning(f"Failed to fetch errors: {e}")

        # 4. Golden dataset
        try:
            golden_col = self.client.collections.get(settings.GOLDEN_COLLECTION_NAME)
            golden_result = golden_col.query.fetch_objects(
                filters=wvc_query.Filter.by_property("function_name").equal(function_name),
                limit=5,
            )
            if golden_result.objects:
                parts.append(f"\n### Golden Records ({len(golden_result.objects)})")
                for obj in golden_result.objects:
                    p = obj.properties
                    parts.append(f"- Input: {p.get('input_data', 'N/A')}, Output: {p.get('output_data', 'N/A')}")
        except Exception as e:
            logger.warning(f"Failed to fetch golden dataset: {e}")

        return "\n".join(parts) if parts else "No data available for this function."

    def _build_general_context(self) -> str:
        """Build context across all functions."""
        parts = []

        # 1. All registered functions
        try:
            func_col = self.client.collections.get(settings.COLLECTION_NAME)
            func_result = func_col.query.fetch_objects(limit=50)
            if func_result.objects:
                parts.append("### Registered Functions")
                for obj in func_result.objects:
                    p = obj.properties
                    name = p.get("function_name", "unknown")
                    module = p.get("module_name", "")
                    parts.append(f"- {name} ({module})")
        except Exception as e:
            logger.warning(f"Failed to fetch functions: {e}")

        # 2. Recent errors across all functions
        try:
            errors = find_executions(
                self.client,
                filters={"status": "ERROR"},
                limit=15,
                sort_by="timestamp_utc",
                sort_ascending=False,
            )
            if errors:
                parts.append(f"\n### Recent Errors ({len(errors)})")
                for err in errors:
                    parts.append(
                        f"- {err.get('function_name', 'N/A')}: "
                        f"[{err.get('error_code', 'N/A')}] {err.get('error_message', 'N/A')}"
                    )
        except Exception as e:
            logger.warning(f"Failed to fetch recent errors: {e}")

        # 3. Overall execution stats
        try:
            recent_all = find_executions(
                self.client,
                filters={},
                limit=50,
                sort_by="timestamp_utc",
                sort_ascending=False,
            )
            if recent_all:
                success = sum(1 for e in recent_all if e.get("status") == "SUCCESS")
                error = sum(1 for e in recent_all if e.get("status") == "ERROR")
                cache = sum(1 for e in recent_all if e.get("status") == "CACHE_HIT")
                parts.append(f"\n### Execution Summary (last {len(recent_all)} executions)")
                parts.append(f"- Success: {success}, Error: {error}, Cache Hit: {cache}")
                if recent_all:
                    parts.append(f"- Latest: {recent_all[0].get('timestamp_utc', 'N/A')}")
        except Exception as e:
            logger.warning(f"Failed to fetch execution stats: {e}")

        return "\n".join(parts) if parts else "No monitoring data available."
