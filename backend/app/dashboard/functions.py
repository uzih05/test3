"""
Function Service

Provides registered function management and search.
Based on: test_ex/search.py, test_ex/hybrid_search.py, test_ex/check.py
"""

import logging
from typing import Dict, Any, Optional, List

import weaviate
import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate, Metrics
from app.core.weaviate_adapter import (
    search_functions, search_functions_hybrid,
    get_registered_functions, find_executions
)
from app.core.config import settings
from app.core.llm_client import get_llm_client

logger = logging.getLogger(__name__)


def _normalize_function(props: Dict[str, Any], extra: Optional[Dict] = None) -> Dict[str, Any]:
    """Normalize Weaviate function properties to frontend-expected field names."""
    result = {
        "function_name": props.get("function_name"),
        "module": props.get("module_name") or props.get("module"),
        "file_path": props.get("file_path"),
        "description": props.get("search_description") or props.get("description"),
        "docstring": props.get("docstring"),
        "source_code": props.get("source_code"),
        "team": props.get("team"),
    }
    if extra:
        result.update(extra)
    return result


class FunctionService:
    """
    Provides function metadata management for the dashboard.
    """

    def __init__(self, client: weaviate.WeaviateClient,
                 connection_type: str = "self_hosted",
                 openai_api_key: str | None = None):
        self.client = client
        self.settings = settings
        self.connection_type = connection_type
        self.openai_api_key = openai_api_key

    def _get_function_stats(self, function_names: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
        """
        Aggregate execution stats per function from VectorWaveExecutions.
        Returns {function_name: {execution_count, avg_duration_ms, error_rate}}.
        """
        try:
            collection = self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

            # Group by function_name to get total count + avg duration
            result = collection.aggregate.over_all(
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True,
                return_metrics=Metrics("duration_ms").number(mean=True),
            )

            stats: Dict[str, Dict[str, Any]] = {}
            for group in result.groups:
                fname = group.grouped_by.value
                if not fname:
                    continue
                if function_names and fname not in function_names:
                    continue
                count = group.total_count or 0
                avg_dur = 0.0
                if group.properties and "duration_ms" in group.properties:
                    avg_dur = group.properties["duration_ms"].mean or 0.0
                stats[fname] = {
                    "execution_count": count,
                    "avg_duration_ms": round(avg_dur, 2),
                    "error_count": 0,
                }

            # Group by function_name with ERROR filter
            error_filter = wvc_query.Filter.by_property("status").equal("ERROR")
            error_result = collection.aggregate.over_all(
                filters=error_filter,
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True,
            )

            for group in error_result.groups:
                fname = group.grouped_by.value
                if not fname or fname not in stats:
                    continue
                stats[fname]["error_count"] = group.total_count or 0

            # Calculate error_rate
            for fname, s in stats.items():
                total = s["execution_count"]
                errors = s["error_count"]
                s["error_rate"] = round(errors / total * 100, 2) if total > 0 else 0.0
                del s["error_count"]

            return stats

        except Exception as e:
            logger.warning(f"Failed to get function stats: {e}")
            return {}

    def get_all_functions(self) -> Dict[str, Any]:
        """
        Returns all registered functions with execution stats.
        """
        try:
            functions = get_registered_functions(self.client)
            stats = self._get_function_stats()

            items = []
            for func in functions:
                normalized = _normalize_function(func)
                fname = normalized.get("function_name")
                if fname and fname in stats:
                    normalized.update(stats[fname])
                items.append(normalized)

            return {
                "items": items,
                "total": len(items)
            }

        except Exception as e:
            logger.error(f"Failed to get all functions: {e}")
            return {
                "items": [],
                "total": 0,
                "error": str(e)
            }

    def search_functions_semantic(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Searches functions using semantic/vector similarity.
        Based on: test_ex/search.py - Scenario 1
        
        Args:
            query: Natural language query
            limit: Maximum number of results
            filters: Additional filters (e.g., {"team": "billing"})
            
        Returns:
            {
                "query": str,
                "items": [...],
                "total": int
            }
        """
        try:
            results = search_functions(
                self.client,
                query=query,
                limit=limit,
                filters=filters,
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )
            
            # Process results for response
            items = []
            for result in results:
                item = _normalize_function(result['properties'], {
                    "uuid": str(result.get('uuid', '')),
                    "distance": result['metadata'].distance if result.get('metadata') else None,
                })
                items.append(item)

            return {
                "query": query,
                "items": items,
                "total": len(items)
            }
            
        except Exception as e:
            logger.error(f"Failed to search functions: {e}")
            return {
                "query": query,
                "items": [],
                "total": 0,
                "error": str(e)
            }

    def search_functions_hybrid_mode(
        self,
        query: str,
        limit: int = 10,
        alpha: float = 0.5,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Searches functions using hybrid search (keyword + vector).
        Based on: test_ex/hybrid_search.py
        
        Args:
            query: Search query
            limit: Maximum number of results
            alpha: Balance between keyword (0) and vector (1) search
            filters: Additional filters
            
        Returns:
            {
                "query": str,
                "alpha": float,
                "items": [...],
                "total": int
            }
        """
        try:
            results = search_functions_hybrid(
                self.client,
                query=query,
                limit=limit,
                alpha=alpha,
                filters=filters,
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )
            
            items = []
            for result in results:
                item = _normalize_function(result['properties'], {
                    "uuid": str(result.get('uuid', '')),
                    "score": result['metadata'].score if result.get('metadata') else None,
                    "distance": result['metadata'].distance if result.get('metadata') else None,
                })
                items.append(item)

            return {
                "query": query,
                "alpha": alpha,
                "items": items,
                "total": len(items)
            }
            
        except Exception as e:
            logger.error(f"Failed to hybrid search functions: {e}")
            return {
                "query": query,
                "alpha": alpha,
                "items": [],
                "total": 0,
                "error": str(e)
            }

    def ask_about_function(
            self,
            query: str,
            language: str = "en",
            openai_api_key: str | None = None,
        ) -> Dict[str, Any]:
            """
            AI에게 함수에 대해 질문합니다. (실행 상태 컨텍스트 포함)
            """
            try:
                # 1. 함수 정의 검색
                search_results = search_functions(
                    self.client, query=query, limit=1,
                    connection_type=self.connection_type,
                    openai_api_key=self.openai_api_key,
                )

                if not search_results:
                    msg = "관련 함수를 찾을 수 없습니다." if language == 'ko' else "No relevant function found."
                    return {"query": query, "answer": msg, "language": language}

                best_match = search_results[0]
                props = best_match['properties']
                function_name = props.get('function_name')

                # 2. 실행 정보 검색 (Runtime Context)
                # 2-1. 최근 에러 조회 (최근 24시간 or 최근 5개)
                recent_errors = find_executions(
                    self.client,
                    filters={"function_name": function_name, "status": "ERROR"},
                    sort_by="timestamp_utc",
                    sort_ascending=False,
                    limit=3
                )

                # 2-2. 최근 성공/성능 조회
                recent_success = find_executions(
                    self.client,
                    filters={"function_name": function_name, "status": "SUCCESS"},
                    sort_by="timestamp_utc",
                    sort_ascending=False,
                    limit=5
                )

                # 3. 프롬프트 컨텍스트 구성 (Augmentation)
                context = f"""
                [Target Function]: {function_name}
                [Docstring]: {props.get('docstring')}

                [Source Code]:
                ```python
                {props.get('source_code')}
                ```

                [Runtime Analysis - Recent Activity]:
                """

                # 에러 정보 주입
                if recent_errors:
                    context += f"\n- ⚠️ WARNING: {len(recent_errors)} recent errors found."
                    context += f"\n- Latest Error Message: {recent_errors[0].get('error_message')}"
                else:
                    context += "\n- ✅ No recent errors found."

                # 성능 정보 주입
                if recent_success:
                    total_duration = sum(float(r.get('duration_ms', 0)) for r in recent_success)
                    avg_duration = total_duration / len(recent_success)
                    context += f"\n- Recent Performance: Avg duration {avg_duration:.2f}ms (based on last {len(recent_success)} runs)."

                # 4. LLM 호출
                llm = get_llm_client(openai_api_key)
                if not llm:
                    return {"query": query, "answer": "OpenAI API key not configured. Please set your API key in Settings.", "language": language}

                # 언어 설정
                lang_instruction = "Korean" if language == 'ko' else "English"

                system_instruction = (
                    "You are an intelligent DevOps assistant for VectorWave. "
                    "Analyze the provided function code AND its recent runtime status. "
                    "If there are errors in the runtime analysis, explain why they might be happening based on the code logic. "
                    f"Please answer in **{lang_instruction}**."
                )

                response_text = llm.chat(
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
                    ],
                    model="gpt-4o-mini",
                    temperature=0.2
                )

                return {
                    "query": query,
                    "answer": response_text,
                    "language": language
                }

            except Exception as e:
                logger.error(f"Failed to answer question: {e}")
                return {
                    "query": query,
                    "answer": f"Error occurred during analysis: {str(e)}",
                    "language": language
                }

    def get_function_by_name(self, function_name: str) -> Optional[Dict[str, Any]]:
        """
        Returns detailed information about a specific function with execution stats.
        """
        try:
            results = search_functions_hybrid(
                self.client,
                query=function_name,
                limit=5,
                alpha=0.1,
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )

            for result in results:
                if result['properties'].get('function_name') == function_name:
                    item = _normalize_function(result['properties'], {
                        "uuid": str(result.get('uuid', '')),
                    })
                    # Add execution stats
                    stats = self._get_function_stats([function_name])
                    if function_name in stats:
                        item.update(stats[function_name])
                    return item

            return None

        except Exception as e:
            logger.error(f"Failed to get function {function_name}: {e}")
            return None

    def get_functions_by_team(self, team: str) -> Dict[str, Any]:
        """
        Returns all functions belonging to a specific team.
        
        Args:
            team: Team name filter
            
        Returns:
            {
                "team": str,
                "items": [...],
                "total": int
            }
        """
        try:
            # Search with team filter
            results = search_functions_hybrid(
                self.client,
                query="*",  # Match all
                limit=100,
                alpha=0.0,  # Pure keyword
                filters={"team": team},
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )
            
            items = []
            for result in results:
                items.append(_normalize_function(result['properties']))
            
            return {
                "team": team,
                "items": items,
                "total": len(items)
            }
            
        except Exception as e:
            logger.error(f"Failed to get functions by team {team}: {e}")
            return {
                "team": team,
                "items": [],
                "total": 0,
                "error": str(e)
            }
