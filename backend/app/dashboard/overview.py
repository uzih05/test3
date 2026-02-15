"""
Dashboard Overview Service

Provides aggregated statistics and KPIs for the dashboard overview page.
Based on: test_ex/token_usage_demo.py, test_ex/advanced_search.py

[수정사항]
- get_kpi_metrics: limit=10000 메모리 집계 → Weaviate Aggregate API 사용
- get_function_distribution: 동일
- get_error_code_distribution: 동일
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from app.core.config import settings
from app.core.weaviate_adapter import (
    get_db_status, get_registered_functions, get_token_usage_stats
)

import weaviate
import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate

logger = logging.getLogger(__name__)


class DashboardOverviewService:
    """
    Provides aggregated metrics and KPIs for the dashboard overview.
    """

    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.settings = settings

    def _get_execution_collection(self):
        """Returns the execution collection for aggregate queries."""
        return self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

    def get_system_status(self) -> Dict[str, Any]:
        """
        Returns the overall system health status.
        
        Returns:
            {
                "db_connected": bool,
                "registered_functions_count": int,
                "last_checked": str (ISO format)
            }
        """
        try:
            db_status = get_db_status(self.client)
            functions = get_registered_functions(self.client) if db_status else []
            
            return {
                "db_connected": db_status,
                "registered_functions_count": len(functions),
                "last_checked": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get system status: {e}")
            return {
                "db_connected": False,
                "registered_functions_count": 0,
                "last_checked": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }

    def get_kpi_metrics(self, time_range_minutes: int = 60) -> Dict[str, Any]:
        """
        Returns key performance indicators for the specified time range.
        [수정] Weaviate Aggregate API 사용하여 DB 레벨에서 집계
        
        Args:
            time_range_minutes: Time range in minutes (default: 60)
            
        Returns:
            {
                "total_executions": int,
                "success_count": int,
                "error_count": int,
                "cache_hit_count": int,
                "success_rate": float (0-100),
                "avg_duration_ms": float,
                "time_range_minutes": int
            }
        """
        try:
            collection = self._get_execution_collection()
            time_limit = (datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes))

            # 시간 필터
            time_filter = wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(time_limit)
            
            # 1. 전체 카운트 (Aggregate)
            total_result = collection.aggregate.over_all(
                filters=time_filter,
                total_count=True
            )
            total = total_result.total_count or 0
            
            # 2. 상태별 카운트 (Group By Aggregate)
            status_result = collection.aggregate.over_all(
                filters=time_filter,
                group_by=GroupByAggregate(prop="status"),
                total_count=True
            )
            
            success_count = 0
            error_count = 0
            cache_hit_count = 0
            
            for group in status_result.groups:
                status_value = group.grouped_by.value
                count = group.total_count or 0
                
                if status_value == "SUCCESS":
                    success_count = count
                elif status_value == "ERROR":
                    error_count = count
                elif status_value == "CACHE_HIT":
                    cache_hit_count = count
            
            # 3. 평균 duration (SUCCESS만, CACHE_HIT 제외)
            # Aggregate로 평균 계산
            from weaviate.classes.aggregate import Metrics
            
            duration_result = collection.aggregate.over_all(
                filters=(
                    time_filter &
                    wvc_query.Filter.by_property("status").not_equal("CACHE_HIT")
                ),
                return_metrics=Metrics("duration_ms").number(mean=True)
            )
            
            avg_duration = 0.0
            if duration_result.properties and "duration_ms" in duration_result.properties:
                avg_duration = duration_result.properties["duration_ms"].mean or 0.0
            
            success_rate = (success_count / total * 100) if total > 0 else 0
            
            return {
                "total_executions": total,
                "success_count": success_count,
                "error_count": error_count,
                "cache_hit_count": cache_hit_count,
                "success_rate": round(success_rate, 2),
                "avg_duration_ms": round(avg_duration, 2),
                "time_range_minutes": time_range_minutes
            }
            
        except Exception as e:
            logger.error(f"Failed to get KPI metrics: {e}")
            return {
                "total_executions": 0,
                "success_count": 0,
                "error_count": 0,
                "cache_hit_count": 0,
                "success_rate": 0,
                "avg_duration_ms": 0,
                "time_range_minutes": time_range_minutes,
                "error": str(e)
            }

    def get_token_usage(self) -> Dict[str, Any]:
        """
        Returns token usage statistics.
        Based on: test_ex/token_usage_demo.py
        
        Returns:
            {
                "total_tokens": int,
                "by_category": { "category_name": int, ... }
            }
        """
        try:
            stats = get_token_usage_stats(self.client)
            
            # Separate total from category breakdown
            total = stats.pop('total_tokens', 0)
            
            return {
                "total_tokens": total,
                "by_category": stats
            }
        except Exception as e:
            logger.error(f"Failed to get token usage: {e}")
            return {
                "total_tokens": 0,
                "by_category": {},
                "error": str(e)
            }

    def get_execution_timeline(
        self, 
        time_range_minutes: int = 60,
        bucket_size_minutes: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Returns execution counts grouped by time buckets for timeline charts.
        [참고] 타임라인은 버킷별로 쿼리해야 해서 Aggregate 최적화가 제한적
        하지만 각 버킷에서 전체 fetch 대신 count만 가져오도록 개선
        
        Args:
            time_range_minutes: Total time range to query
            bucket_size_minutes: Size of each time bucket
            
        Returns:
            [
                {
                    "timestamp": str (ISO format),
                    "success": int,
                    "error": int,
                    "cache_hit": int
                },
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
                
                # 버킷 시간 범위 필터
                bucket_filter = (
                    wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(bucket_start) &
                    wvc_query.Filter.by_property("timestamp_utc").less_than(bucket_end)
                )
                
                # 상태별 집계
                try:
                    status_result = collection.aggregate.over_all(
                        filters=bucket_filter,
                        group_by=GroupByAggregate(prop="status"),
                        total_count=True
                    )
                    
                    bucket_data = {
                        "timestamp": bucket_start.isoformat(),
                        "success": 0,
                        "error": 0,
                        "cache_hit": 0
                    }
                    
                    for group in status_result.groups:
                        status_value = group.grouped_by.value
                        count = group.total_count or 0
                        
                        if status_value == "SUCCESS":
                            bucket_data["success"] = count
                        elif status_value == "ERROR":
                            bucket_data["error"] = count
                        elif status_value == "CACHE_HIT":
                            bucket_data["cache_hit"] = count
                    
                    buckets.append(bucket_data)
                    
                except Exception as bucket_error:
                    logger.warning(f"Failed to aggregate bucket {i}: {bucket_error}")
                    buckets.append({
                        "timestamp": bucket_start.isoformat(),
                        "success": 0,
                        "error": 0,
                        "cache_hit": 0
                    })
            
            return buckets
            
        except Exception as e:
            logger.error(f"Failed to get execution timeline: {e}")
            return []

    def get_function_distribution(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Returns execution count by function name for pie/donut charts.
        [수정] Weaviate Aggregate Group By 사용
        
        Returns:
            [
                {"function_name": str, "count": int, "percentage": float},
                ...
            ]
        """
        try:
            collection = self._get_execution_collection()
            
            # Group by function_name
            result = collection.aggregate.over_all(
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True
            )
            
            # 결과를 리스트로 변환하고 정렬
            func_counts = []
            for group in result.groups:
                func_name = group.grouped_by.value or "unknown"
                count = group.total_count or 0
                func_counts.append({"function_name": func_name, "count": count})
            
            # count 기준 내림차순 정렬 후 limit 적용
            func_counts.sort(key=lambda x: x["count"], reverse=True)
            top_funcs = func_counts[:limit]
            
            # 퍼센티지 계산
            total = sum(f["count"] for f in top_funcs)
            
            return [
                {
                    "function_name": f["function_name"],
                    "count": f["count"],
                    "percentage": round(f["count"] / total * 100, 2) if total > 0 else 0
                }
                for f in top_funcs
            ]
            
        except Exception as e:
            logger.error(f"Failed to get function distribution: {e}")
            return []

    def get_error_code_distribution(self, time_range_minutes: int = 1440) -> List[Dict[str, Any]]:
        """
        Returns error count by error_code for the specified time range.
        [수정] Weaviate Aggregate Group By 사용
        
        Returns:
            [
                {"error_code": str, "count": int, "percentage": float},
                ...
            ]
        """
        try:
            collection = self._get_execution_collection()
            time_limit = (datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes))

            # 에러만 필터링 + 시간 필터
            error_filter = (
                wvc_query.Filter.by_property("status").equal("ERROR") &
                wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(time_limit)
            )
            
            # Group by error_code
            result = collection.aggregate.over_all(
                filters=error_filter,
                group_by=GroupByAggregate(prop="error_code"),
                total_count=True
            )
            
            # 결과를 리스트로 변환
            code_counts = []
            for group in result.groups:
                error_code = group.grouped_by.value or "UNKNOWN"
                count = group.total_count or 0
                code_counts.append({"error_code": error_code, "count": count})
            
            # count 기준 내림차순 정렬
            code_counts.sort(key=lambda x: x["count"], reverse=True)
            
            # 퍼센티지 계산
            total = sum(c["count"] for c in code_counts)
            
            return [
                {
                    "error_code": c["error_code"],
                    "count": c["count"],
                    "percentage": round(c["count"] / total * 100, 2) if total > 0 else 0
                }
                for c in code_counts
            ]
            
        except Exception as e:
            logger.error(f"Failed to get error code distribution: {e}")
            return []
