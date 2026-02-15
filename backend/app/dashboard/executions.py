"""
Execution Service

Provides execution log querying with filtering, sorting, and pagination.
Based on: test_ex/search.py, test_ex/advanced_search.py
"""

import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

import weaviate
from app.core.weaviate_adapter import (
    search_executions, find_executions,
    find_recent_errors, find_slowest_executions
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class ExecutionService:
    """
    Provides execution log management for the dashboard.
    """

    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.settings = settings

    def get_executions(
        self,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None,
        function_name: Optional[str] = None,
        team: Optional[str] = None,
        error_code: Optional[str] = None,
        time_range_minutes: Optional[int] = None,
        sort_by: str = "timestamp_utc",
        sort_ascending: bool = False
    ) -> Dict[str, Any]:
        """
        Returns paginated execution logs with optional filtering.
        
        Args:
            limit: Maximum number of results
            offset: Number of results to skip (for pagination)
            status: Filter by status ('SUCCESS', 'ERROR', 'CACHE_HIT')
            function_name: Filter by function name
            team: Filter by team tag
            error_code: Filter by error code
            time_range_minutes: Filter by time range
            sort_by: Field to sort by
            sort_ascending: Sort direction
            
        Returns:
            {
                "items": [...],
                "total": int (estimated),
                "limit": int,
                "offset": int
            }
        """
        try:
            filters = {}
            
            if status:
                filters["status"] = status
            if function_name:
                filters["function_name"] = function_name
            if team:
                filters["team"] = team
            if error_code:
                filters["error_code"] = error_code
            if time_range_minutes:
                time_limit = (datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes)).isoformat()
                filters["timestamp_utc__gte"] = time_limit
            
            # Note: Weaviate doesn't support true offset pagination
            # We fetch more and slice (not ideal for large datasets)
            fetch_limit = limit + offset
            
            executions = find_executions(
                self.client,
                filters=filters if filters else None,
                limit=fetch_limit,
                sort_by=sort_by,
                sort_ascending=sort_ascending
            )
            
            # Apply offset
            paginated = executions[offset:offset + limit]
            
            # Serialize for JSON response
            items = [self._serialize_execution(e) for e in paginated]
            
            return {
                "items": items,
                "total": len(executions),  # This is an estimate
                "limit": limit,
                "offset": offset
            }
            
        except Exception as e:
            logger.error(f"Failed to get executions: {e}")
            return {
                "items": [],
                "total": 0,
                "limit": limit,
                "offset": offset,
                "error": str(e)
            }

    def get_recent_errors(
        self,
        minutes_ago: int = 60,
        limit: int = 20,
        error_codes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Returns recent error logs.
        Based on: test_ex/advanced_search.py - find_recent_errors
        
        Args:
            minutes_ago: Time range in minutes
            limit: Maximum number of results
            error_codes: Filter by specific error codes
            
        Returns:
            {
                "items": [...],
                "total": int,
                "time_range_minutes": int
            }
        """
        try:
            errors = find_recent_errors(
                self.client,
                minutes_ago=minutes_ago,
                limit=limit,
                error_codes=error_codes
            )
            
            items = [self._serialize_execution(e) for e in errors]
            
            return {
                "items": items,
                "total": len(items),
                "time_range_minutes": minutes_ago
            }
            
        except Exception as e:
            logger.error(f"Failed to get recent errors: {e}")
            return {
                "items": [],
                "total": 0,
                "time_range_minutes": minutes_ago,
                "error": str(e)
            }

    def get_slowest_executions(
        self,
        limit: int = 10,
        min_duration_ms: float = 0.0
    ) -> Dict[str, Any]:
        """
        Returns the slowest execution logs.
        Based on: test_ex/advanced_search.py - find_slowest_executions
        
        Args:
            limit: Maximum number of results
            min_duration_ms: Minimum duration threshold
            
        Returns:
            {
                "items": [...],
                "total": int
            }
        """
        try:
            slowest = find_slowest_executions(
                self.client,
                limit=limit,
                min_duration_ms=min_duration_ms
            )
            
            items = [self._serialize_execution(e) for e in slowest]
            
            return {
                "items": items,
                "total": len(items)
            }
            
        except Exception as e:
            logger.error(f"Failed to get slowest executions: {e}")
            return {
                "items": [],
                "total": 0,
                "error": str(e)
            }

    def get_execution_by_id(self, span_id: str) -> Optional[Dict[str, Any]]:
        """
        Returns a single execution log by span_id.
        
        Args:
            span_id: The span ID to look up
            
        Returns:
            Execution log dict or None if not found
        """
        try:
            executions = search_executions(
                self.client,
                limit=1,
                filters={"span_id": span_id}
            )
            
            if executions:
                return self._serialize_execution(executions[0])
            return None
            
        except Exception as e:
            logger.error(f"Failed to get execution by ID: {e}")
            return None

    def _serialize_execution(self, execution: Dict[str, Any]) -> Dict[str, Any]:
            """
            실행 로그 데이터를 JSON 직렬화하고, 프론트엔드용 필드(input/output)를 매핑합니다.
            """
            serialized = {}
            input_args = {}

            # VectorWave 시스템 내부 필드 (사용자 입력값이 아님)
            SYSTEM_KEYS = {
                'uuid', 'trace_id', 'span_id', 'parent_span_id',
                'function_name', 'timestamp_utc', 'duration_ms',
                'status', 'error_message', 'error_code',
                'return_value', 'exec_source', 'function_uuid',
                'team', 'priority', 'vector'
            }

            for key, value in execution.items():
                # 날짜/시간 및 UUID 직렬화
                if isinstance(value, datetime):
                    processed_val = value.isoformat()
                elif hasattr(value, '__str__'):
                    processed_val = str(value)
                else:
                    processed_val = value

                serialized[key] = processed_val

                # [핵심] 시스템 키가 아닌 항목은 모두 '입력 인자'로 간주하여 수집
                if key not in SYSTEM_KEYS and not key.startswith('_'):
                    input_args[key] = processed_val

            # [매핑 1] Output Preview: DB의 return_value를 매핑
            if 'return_value' in serialized:
                serialized['output_preview'] = serialized['return_value']

            # [매핑 2] Input Preview: 수집된 인자들을 JSON 문자열로 변환하여 매핑
            if input_args:
                try:
                    # 보기 좋게 들여쓰기 포함
                    serialized['input_preview'] = json.dumps(input_args, indent=2, ensure_ascii=False)
                except Exception:
                    serialized['input_preview'] = str(input_args)

            return serialized
