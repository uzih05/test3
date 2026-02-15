"""
Cache Analytics Service

Provides cache hit rate, golden vs standard ratio, and time saved metrics.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

import weaviate
import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate, Metrics

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Provides cache analytics for the dashboard."""

    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.settings = settings

    def get_cache_analytics(self, time_range_minutes: int = 60) -> Dict[str, Any]:
        """
        Get cache analytics: hit rate, golden vs standard ratio, time saved.
        """
        try:
            collection = self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

            # Time filter
            time_filter = None
            if time_range_minutes > 0:
                time_limit = datetime.now(timezone.utc) - timedelta(minutes=time_range_minutes)
                time_filter = wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(time_limit)

            # Total executions count
            total_result = collection.aggregate.over_all(
                filters=time_filter,
                total_count=True,
            )
            total_count = total_result.total_count or 0

            # Cache hit count
            cache_filter = wvc_query.Filter.by_property("status").equal("CACHE_HIT")
            if time_filter:
                cache_filter = cache_filter & time_filter

            cache_result = collection.aggregate.over_all(
                filters=cache_filter,
                total_count=True,
                return_metrics=Metrics("duration_ms").number(mean=True),
            )
            cache_hit_count = cache_result.total_count or 0

            avg_duration = 0.0
            if cache_result.properties and "duration_ms" in cache_result.properties:
                avg_duration = cache_result.properties["duration_ms"].mean or 0.0

            # Cache hit rate
            cache_hit_rate = round(cache_hit_count / total_count * 100, 2) if total_count > 0 else 0.0

            # Golden dataset count from dedicated collection
            golden_hit_count = 0
            try:
                golden_cname = self.settings.GOLDEN_COLLECTION_NAME
                if self.client.collections.exists(golden_cname):
                    golden_col = self.client.collections.get(golden_cname)
                    golden_agg = golden_col.aggregate.over_all(total_count=True)
                    golden_hit_count = golden_agg.total_count or 0
            except Exception as e:
                logger.warning(f"Golden dataset count failed: {e}")
            standard_hit_count = max(0, cache_hit_count - golden_hit_count)

            golden_ratio = round(golden_hit_count / cache_hit_count * 100, 2) if cache_hit_count > 0 else 0.0

            # Time saved estimation (avg_duration * cache_hit_count)
            time_saved_ms = round(avg_duration * cache_hit_count, 2)

            return {
                "total_executions": total_count,
                "cache_hit_count": cache_hit_count,
                "cache_hit_rate": cache_hit_rate,
                "golden_hit_count": golden_hit_count,
                "standard_hit_count": standard_hit_count,
                "golden_ratio": golden_ratio,
                "time_saved_ms": time_saved_ms,
                "avg_cached_duration_ms": round(avg_duration, 2),
                "time_range_minutes": time_range_minutes,
                "has_data": total_count > 0,
            }

        except Exception as e:
            logger.error(f"Failed to get cache analytics: {e}")
            return {
                "total_executions": 0,
                "cache_hit_count": 0,
                "cache_hit_rate": 0.0,
                "golden_hit_count": 0,
                "standard_hit_count": 0,
                "golden_ratio": 0.0,
                "time_saved_ms": 0.0,
                "avg_cached_duration_ms": 0.0,
                "time_range_minutes": time_range_minutes,
                "error": str(e),
            }
