"""
Archiver Service

Extracts execution logs and golden dataset records,
converts them to OpenAI Chat Completion JSONL format for LLM fine-tuning.
"""

import json
from typing import Generator, Dict, Any, Optional

import weaviate

from app.dashboard.executions import ExecutionService
from app.dashboard.golden_dataset import GoldenDatasetService
from app.dashboard.functions import FunctionService


class ArchiverService:
    def __init__(self, client: weaviate.WeaviateClient):
        self.exec_service = ExecutionService(client)
        self.golden_service = GoldenDatasetService(client)
        self.func_service = FunctionService(client)
        self._docstring_cache: dict[str, str] = {}

    def _get_docstring(self, function_name: str) -> str:
        if function_name not in self._docstring_cache:
            try:
                detail = self.func_service.get_function_by_name(function_name)
                self._docstring_cache[function_name] = (detail or {}).get("docstring", "") or ""
            except Exception:
                self._docstring_cache[function_name] = ""
        return self._docstring_cache[function_name]

    def _to_jsonl_entry(self, function_name: str, inputs, output: str) -> dict:
        docstring = self._get_docstring(function_name)
        system_content = (
            f"Function '{function_name}' executes logic based on the following context: {docstring}"
            if docstring
            else f"Function '{function_name}'"
        )

        input_str = json.dumps(inputs, ensure_ascii=False) if isinstance(inputs, dict) else str(inputs)

        return {
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": input_str},
                {"role": "assistant", "content": str(output)},
            ]
        }

    def get_preview(
        self,
        function_name: Optional[str] = None,
        include_golden: bool = False,
        limit: int = 5,
    ) -> Dict[str, Any]:
        exec_data = self.exec_service.get_executions(
            function_name=function_name, status="SUCCESS", limit=200
        )
        executions = exec_data.get("items", [])

        golden_records = []
        if include_golden:
            golden_data = self.golden_service.list_golden(
                function_name=function_name, limit=200
            )
            golden_records = golden_data.get("items", [])

        functions_set = set()
        for e in executions:
            functions_set.add(e.get("function_name", "unknown"))
        for g in golden_records:
            functions_set.add(g.get("function_name", "unknown"))

        total_count = len(executions) + len(golden_records)

        samples = []
        for e in executions[:limit]:
            fn = e.get("function_name", "unknown")
            samples.append(self._to_jsonl_entry(
                fn, e.get("inputs", {}), e.get("return_value", "")
            ))
        for g in golden_records[:max(0, limit - len(samples))]:
            fn = g.get("function_name", "unknown")
            samples.append(self._to_jsonl_entry(
                fn, g.get("input_preview", ""), g.get("output_preview", "")
            ))

        return {
            "total_records": total_count,
            "execution_count": len(executions),
            "golden_count": len(golden_records),
            "unique_functions": len(functions_set),
            "function_names": sorted(functions_set),
            "samples": samples,
        }

    def generate_jsonl(
        self,
        function_name: Optional[str] = None,
        include_golden: bool = False,
    ) -> Generator[str, None, None]:
        exec_data = self.exec_service.get_executions(
            function_name=function_name, status="SUCCESS", limit=10000
        )
        for e in exec_data.get("items", []):
            fn = e.get("function_name", "unknown")
            entry = self._to_jsonl_entry(fn, e.get("inputs", {}), e.get("return_value", ""))
            yield json.dumps(entry, ensure_ascii=False) + "\n"

        if include_golden:
            golden_data = self.golden_service.list_golden(
                function_name=function_name, limit=10000
            )
            for g in golden_data.get("items", []):
                fn = g.get("function_name", "unknown")
                entry = self._to_jsonl_entry(fn, g.get("input_preview", ""), g.get("output_preview", ""))
                yield json.dumps(entry, ensure_ascii=False) + "\n"
