"""
Error Service

Provides error analysis and semantic error search.
Based on: test_ex/advanced_search.py (Scenario 5), test_ex/check_all_errors.py

[수정사항]
- get_error_summary: limit=10000 메모리 집계 → Weaviate Aggregate API 사용
- get_error_trends: 버킷별 Aggregate 사용
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

import weaviate
from app.core.weaviate_adapter import (
    search_executions, search_errors_by_message,
    find_executions, find_recent_errors
)
from app.core.config import settings

import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate

logger = logging.getLogger(__name__)


class ErrorService:
    """
    Provides error management and analysis for the dashboard.
    """

    def __init__(self, client: weaviate.WeaviateClient,
                 connection_type: str = "self_hosted",
                 openai_api_key: str | None = None):
        self.client = client
        self.settings = settings
        self.connection_type = connection_type
        self.openai_api_key = openai_api_key

    def _get_execution_collection(self):
        """Returns the execution collection for aggregate queries."""
        return self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

    def get_errors(
        self,
        limit: int = 50,
        function_name: Optional[str] = None,
        error_code: Optional[str] = None,
        error_codes: Optional[List[str]] = None,
        team: Optional[str] = None,
        time_range_minutes: Optional[int] = None,
        sort_by: str = "timestamp_utc",
        sort_ascending: bool = False
    ) -> Dict[str, Any]:
        """
        Returns error logs with optional filtering.
        Based on: test_ex/check_all_errors.py
        
        Args:
            limit: Maximum number of results
            function_name: Filter by function name
            error_code: Filter by single error code
            error_codes: Filter by multiple error codes
            team: Filter by team
            time_range_minutes: Filter by time range
            sort_by: Field to sort by
            sort_ascending: Sort direction
            
        Returns:
            {
                "items": [...],
                "total": int,
                "filters_applied": dict
            }
        """
        try:
            filters = {"status": "ERROR"}
            
            if function_name:
                filters["function_name"] = function_name
            if error_code:
                filters["error_code"] = error_code
            elif error_codes:
                filters["error_code"] = error_codes
            if team:
                filters["team"] = team
            if time_range_minutes:
                time_limit = (datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes)).isoformat()
                filters["timestamp_utc__gte"] = time_limit
            
            errors = find_executions(
                self.client,
                filters=filters,
                limit=limit,
                sort_by=sort_by,
                sort_ascending=sort_ascending
            )
            
            items = [self._serialize_error(e) for e in errors]
            
            return {
                "items": items,
                "total": len(items),
                "filters_applied": {
                    "function_name": function_name,
                    "error_code": error_code or error_codes,
                    "team": team,
                    "time_range_minutes": time_range_minutes
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get errors: {e}")
            return {
                "items": [],
                "total": 0,
                "error": str(e)
            }

    def search_errors_semantic(
        self,
        query: str,
        limit: int = 10,
        function_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Searches errors using semantic/vector similarity.
        Based on: test_ex/advanced_search.py - Scenario 5
        
        Args:
            query: Natural language description of the error
            limit: Maximum number of results
            function_name: Optional function name filter
            
        Returns:
            {
                "query": str,
                "items": [...],
                "total": int
            }
        """
        try:
            filters = {}
            if function_name:
                filters["function_name"] = function_name
            
            results = search_errors_by_message(
                self.client,
                query=query,
                limit=limit,
                filters=filters if filters else None,
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )
            
            items = []
            for result in results:
                error_msg = result['properties'].get('error_message', '')
                # Extract last line (actual error) from full traceback
                simple_msg = error_msg.strip().split('\n')[-1] if error_msg else 'N/A'
                
                items.append({
                    "uuid": str(result.get('uuid', '')),
                    "function_name": result['properties'].get('function_name'),
                    "error_code": result['properties'].get('error_code'),
                    "error_message": simple_msg,
                    "error_message_full": error_msg,
                    "timestamp_utc": result['properties'].get('timestamp_utc'),
                    "trace_id": result['properties'].get('trace_id'),
                    "span_id": result['properties'].get('span_id'),
                    "distance": result['metadata'].distance if result.get('metadata') else None
                })
            
            return {
                "query": query,
                "items": items,
                "total": len(items)
            }
            
        except Exception as e:
            logger.error(f"Failed to search errors semantically: {e}")
            return {
                "query": query,
                "items": [],
                "total": 0,
                "error": str(e)
            }

    def get_error_summary(self, time_range_minutes: int = 1440) -> Dict[str, Any]:
        """
        Returns a summary of errors for the specified time range.
        [수정] Weaviate Aggregate API 사용하여 DB 레벨에서 집계
        
        Args:
            time_range_minutes: Time range in minutes (default: 24 hours)
            
        Returns:
            {
                "total_errors": int,
                "by_error_code": [...],
                "by_function": [...],
                "by_team": [...],
                "time_range_minutes": int
            }
        """
        try:
            collection = self._get_execution_collection()
            time_limit = (datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes))

            # 기본 필터: ERROR 상태 + 시간 범위
            base_filter = (
                wvc_query.Filter.by_property("status").equal("ERROR") &
                wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(time_limit)
            )
            
            # 1. 전체 에러 카운트
            total_result = collection.aggregate.over_all(
                filters=base_filter,
                total_count=True
            )
            total_errors = total_result.total_count or 0
            
            # 2. error_code별 집계
            code_result = collection.aggregate.over_all(
                filters=base_filter,
                group_by=GroupByAggregate(prop="error_code"),
                total_count=True
            )
            
            by_error_code = []
            for group in code_result.groups:
                by_error_code.append({
                    "error_code": group.grouped_by.value or "UNKNOWN",
                    "count": group.total_count or 0
                })
            by_error_code.sort(key=lambda x: x["count"], reverse=True)
            
            # 3. function_name별 집계
            func_result = collection.aggregate.over_all(
                filters=base_filter,
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True
            )
            
            by_function = []
            for group in func_result.groups:
                by_function.append({
                    "function_name": group.grouped_by.value or "unknown",
                    "count": group.total_count or 0
                })
            by_function.sort(key=lambda x: x["count"], reverse=True)
            by_function = by_function[:10]  # Top 10
            
            # 4. team별 집계
            team_result = collection.aggregate.over_all(
                filters=base_filter,
                group_by=GroupByAggregate(prop="team"),
                total_count=True
            )
            
            by_team = []
            for group in team_result.groups:
                by_team.append({
                    "team": group.grouped_by.value or "unassigned",
                    "count": group.total_count or 0
                })
            by_team.sort(key=lambda x: x["count"], reverse=True)
            
            return {
                "total_errors": total_errors,
                "by_error_code": by_error_code,
                "by_function": by_function,
                "by_team": by_team,
                "time_range_minutes": time_range_minutes
            }
            
        except Exception as e:
            logger.error(f"Failed to get error summary: {e}")
            return {
                "total_errors": 0,
                "by_error_code": [],
                "by_function": [],
                "by_team": [],
                "time_range_minutes": time_range_minutes,
                "error": str(e)
            }

    def get_error_trends(
        self,
        time_range_minutes: int = 1440,
        bucket_size_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Returns error counts over time for trend visualization.
        [수정] 버킷별 Weaviate Aggregate 사용
        
        Args:
            time_range_minutes: Total time range
            bucket_size_minutes: Size of each time bucket
            
        Returns:
            [
                {"timestamp": str, "count": int, "error_codes": {...}},
                ...
            ]
        """
        try:
            collection = self._get_execution_collection()
            now = datetime.now(timezone.utc)
            time_limit = now - timedelta(minutes=time_range_minutes)
            
            # Create time buckets
            num_buckets = time_range_minutes // bucket_size_minutes
            buckets = []
            
            for i in range(num_buckets):
                bucket_start = time_limit + timedelta(minutes=i * bucket_size_minutes)
                bucket_end = bucket_start + timedelta(minutes=bucket_size_minutes)
                
                # 버킷 필터: ERROR + 시간 범위
                bucket_filter = (
                    wvc_query.Filter.by_property("status").equal("ERROR") &
                    wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(bucket_start) &
                    wvc_query.Filter.by_property("timestamp_utc").less_than(bucket_end)
                )
                
                try:
                    # error_code별 집계
                    result = collection.aggregate.over_all(
                        filters=bucket_filter,
                        group_by=GroupByAggregate(prop="error_code"),
                        total_count=True
                    )
                    
                    code_counts = {}
                    total_count = 0
                    for group in result.groups:
                        code = group.grouped_by.value or "UNKNOWN"
                        count = group.total_count or 0
                        code_counts[code] = count
                        total_count += count
                    
                    buckets.append({
                        "timestamp": bucket_start.isoformat(),
                        "count": total_count,
                        "error_codes": code_counts
                    })
                    
                except Exception as bucket_error:
                    logger.warning(f"Failed to aggregate error bucket {i}: {bucket_error}")
                    buckets.append({
                        "timestamp": bucket_start.isoformat(),
                        "count": 0,
                        "error_codes": {}
                    })
            
            return buckets
            
        except Exception as e:
            logger.error(f"Failed to get error trends: {e}")
            return []

    def _serialize_error(self, error: Dict[str, Any]) -> Dict[str, Any]:
        """
        Serializes an error log for JSON response.
        Extracts and simplifies error message.
        """
        error_msg = error.get('error_message', '')
        simple_msg = error_msg.strip().split('\n')[-1] if error_msg else 'N/A'
        
        return {
            "span_id": error.get('span_id'),
            "trace_id": error.get('trace_id'),
            "function_name": error.get('function_name'),
            "error_code": error.get('error_code'),
            "error_message": simple_msg,
            "error_message_full": error_msg,
            "timestamp_utc": error.get('timestamp_utc'),
            "duration_ms": error.get('duration_ms'),
            "team": error.get('team'),
            "run_id": error.get('run_id')
        }
