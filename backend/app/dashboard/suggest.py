"""
Suggest Service

Analyzes execution data to generate actionable recommendations.
Pure data analysis using Weaviate Aggregate API — no LLM calls.
"""

import logging
import statistics
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

import weaviate
import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate, Metrics

from app.core.config import settings
from app.core.weaviate_adapter import get_registered_functions

logger = logging.getLogger(__name__)


class SuggestService:
    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.settings = settings

    def _get_execution_collection(self):
        return self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

    def get_suggestions(self, time_range_minutes: int = 1440) -> Dict[str, Any]:
        """Main entry point. Runs all analyzers and returns combined suggestions."""
        try:
            now = datetime.now(timezone.utc)
            time_limit = now - timedelta(minutes=time_range_minutes)
            time_filter = wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(time_limit)

            per_func_stats = self._get_per_function_stats(time_filter)
            registered = self._get_registered_function_names()
            golden_fns = self._get_golden_function_names()

            suggestions: List[Dict[str, Any]] = []
            suggestions.extend(self._check_unused_functions(registered, per_func_stats, time_range_minutes))
            suggestions.extend(self._check_high_error_rate(per_func_stats))
            suggestions.extend(self._check_slow_functions(per_func_stats))
            suggestions.extend(self._check_cache_candidates(per_func_stats))
            suggestions.extend(self._check_no_golden_data(per_func_stats, golden_fns))
            suggestions.extend(self._check_performance_degradation(time_range_minutes))

            priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            suggestions.sort(key=lambda s: priority_order.get(s["priority"], 99))

            return {
                "suggestions": suggestions,
                "total": len(suggestions),
                "time_range_minutes": time_range_minutes,
                "summary": {
                    "critical": sum(1 for s in suggestions if s["priority"] == "critical"),
                    "high": sum(1 for s in suggestions if s["priority"] == "high"),
                    "medium": sum(1 for s in suggestions if s["priority"] == "medium"),
                    "low": sum(1 for s in suggestions if s["priority"] == "low"),
                }
            }
        except Exception as e:
            logger.error(f"Failed to get suggestions: {e}")
            return {
                "suggestions": [],
                "total": 0,
                "time_range_minutes": time_range_minutes,
                "summary": {"critical": 0, "high": 0, "medium": 0, "low": 0},
                "error": str(e),
            }

    # ── Shared data gatherers ──────────────────────────────

    def _get_per_function_stats(self, time_filter) -> Dict[str, Dict[str, Any]]:
        """Gather per-function stats: total_count, error_count, cache_hit_count, avg_duration_ms."""
        collection = self._get_execution_collection()
        stats: Dict[str, Dict[str, Any]] = {}

        # Query 1: total count + avg duration per function
        result = collection.aggregate.over_all(
            filters=time_filter,
            group_by=GroupByAggregate(prop="function_name"),
            total_count=True,
            return_metrics=Metrics("duration_ms").number(mean=True),
        )
        for group in result.groups:
            fname = group.grouped_by.value
            if not fname:
                continue
            avg_dur = 0.0
            if group.properties and "duration_ms" in group.properties:
                avg_dur = group.properties["duration_ms"].mean or 0.0
            stats[fname] = {
                "total_count": group.total_count or 0,
                "avg_duration_ms": round(avg_dur, 2),
                "error_count": 0,
                "cache_hit_count": 0,
            }

        # Query 2: error count per function
        error_filter = wvc_query.Filter.by_property("status").equal("ERROR") & time_filter
        error_result = collection.aggregate.over_all(
            filters=error_filter,
            group_by=GroupByAggregate(prop="function_name"),
            total_count=True,
        )
        for group in error_result.groups:
            fname = group.grouped_by.value
            if fname and fname in stats:
                stats[fname]["error_count"] = group.total_count or 0

        # Query 3: cache hit count per function
        cache_filter = wvc_query.Filter.by_property("status").equal("CACHE_HIT") & time_filter
        cache_result = collection.aggregate.over_all(
            filters=cache_filter,
            group_by=GroupByAggregate(prop="function_name"),
            total_count=True,
        )
        for group in cache_result.groups:
            fname = group.grouped_by.value
            if fname and fname in stats:
                stats[fname]["cache_hit_count"] = group.total_count or 0

        return stats

    def _get_registered_function_names(self) -> set:
        """Get all registered function names from VectorWaveFunctions."""
        funcs = get_registered_functions(self.client)
        return {f.get("function_name") for f in funcs if f.get("function_name")}

    def _get_golden_function_names(self) -> set:
        """Get function names that have at least one golden record."""
        try:
            golden_cname = self.settings.GOLDEN_COLLECTION_NAME
            if not self.client.collections.exists(golden_cname):
                return set()
            golden_col = self.client.collections.get(golden_cname)
            result = golden_col.aggregate.over_all(
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True,
            )
            return {g.grouped_by.value for g in result.groups if g.grouped_by.value}
        except Exception:
            return set()

    # ── Analyzers ──────────────────────────────────────────

    def _check_unused_functions(
        self, registered: set, stats: Dict[str, Dict], time_range_minutes: int
    ) -> List[Dict[str, Any]]:
        suggestions = []
        for fname in registered:
            count = stats.get(fname, {}).get("total_count", 0)
            if count < 3:
                suggestions.append({
                    "type": "unused_function",
                    "priority": "low",
                    "function_name": fname,
                    "message": f"Only {count} executions in the selected period",
                    "metrics": {"execution_count": count, "time_range_minutes": time_range_minutes},
                })
        return suggestions

    def _check_high_error_rate(self, stats: Dict[str, Dict]) -> List[Dict[str, Any]]:
        suggestions = []
        for fname, s in stats.items():
            total = s["total_count"]
            errors = s["error_count"]
            if total < 3:
                continue
            rate = round((errors / total) * 100, 1)
            if rate > 50:
                priority = "critical"
            elif rate > 20:
                priority = "high"
            else:
                continue
            suggestions.append({
                "type": "high_error_rate",
                "priority": priority,
                "function_name": fname,
                "message": f"Error rate is {rate}% ({errors} errors / {total} total)",
                "metrics": {"error_rate": rate, "error_count": errors, "total_count": total},
            })
        return suggestions

    def _check_slow_functions(self, stats: Dict[str, Dict]) -> List[Dict[str, Any]]:
        durations = [
            s["avg_duration_ms"] for s in stats.values()
            if s["total_count"] >= 5 and s["avg_duration_ms"] > 0
        ]
        if len(durations) < 2:
            return []
        median_dur = statistics.median(durations)
        if median_dur <= 0:
            return []

        suggestions = []
        for fname, s in stats.items():
            if s["total_count"] < 5 or s["avg_duration_ms"] <= 0:
                continue
            ratio = s["avg_duration_ms"] / median_dur
            if ratio >= 5:
                priority = "high"
            elif ratio >= 2:
                priority = "medium"
            else:
                continue
            suggestions.append({
                "type": "slow_function",
                "priority": priority,
                "function_name": fname,
                "message": f"Avg {s['avg_duration_ms']:.0f}ms is {ratio:.1f}x the median ({median_dur:.0f}ms)",
                "metrics": {
                    "avg_duration_ms": s["avg_duration_ms"],
                    "median_duration_ms": round(median_dur, 2),
                    "ratio": round(ratio, 2),
                },
            })
        return suggestions

    def _check_cache_candidates(self, stats: Dict[str, Dict]) -> List[Dict[str, Any]]:
        suggestions = []
        for fname, s in stats.items():
            total = s["total_count"]
            cache_hits = s["cache_hit_count"]
            if total < 10:
                continue
            hit_rate = round((cache_hits / total) * 100, 1)
            if hit_rate < 5:
                potential_savings = total - cache_hits
                priority = "high" if total >= 50 and hit_rate < 1 else "medium"
                suggestions.append({
                    "type": "cache_optimization",
                    "priority": priority,
                    "function_name": fname,
                    "message": (
                        f"Cache hit rate is only {hit_rate}% ({cache_hits}/{total} executions). "
                        f"Setting up semantic caching with golden data could save ~{potential_savings} redundant API calls."
                    ),
                    "metrics": {
                        "total_count": total,
                        "cache_hit_count": cache_hits,
                        "cache_hit_rate": hit_rate,
                        "potential_savings": potential_savings,
                    },
                })
        return suggestions

    def _check_no_golden_data(
        self, stats: Dict[str, Dict], golden_fns: set
    ) -> List[Dict[str, Any]]:
        suggestions = []
        for fname, s in stats.items():
            if s["total_count"] < 10:
                continue
            if fname not in golden_fns:
                suggestions.append({
                    "type": "no_golden_data",
                    "priority": "medium",
                    "function_name": fname,
                    "message": f"No golden records — drift detection unavailable ({s['total_count']} executions)",
                    "metrics": {"execution_count": s["total_count"]},
                })
        return suggestions

    def _check_performance_degradation(self, time_range_minutes: int) -> List[Dict[str, Any]]:
        collection = self._get_execution_collection()
        now = datetime.now(timezone.utc)
        half = time_range_minutes // 2
        if half < 5:
            return []

        mid_point = now - timedelta(minutes=half)
        start_point = now - timedelta(minutes=time_range_minutes)
        no_cache = wvc_query.Filter.by_property("status").not_equal("CACHE_HIT")

        first_filter = (
            wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(start_point)
            & wvc_query.Filter.by_property("timestamp_utc").less_than(mid_point)
            & no_cache
        )
        second_filter = (
            wvc_query.Filter.by_property("timestamp_utc").greater_or_equal(mid_point)
            & no_cache
        )

        first_stats = self._aggregate_duration_by_function(collection, first_filter)
        second_stats = self._aggregate_duration_by_function(collection, second_filter)

        suggestions = []
        for fname, second_avg in second_stats.items():
            first_avg = first_stats.get(fname)
            if not first_avg or first_avg <= 0:
                continue
            ratio = round(second_avg / first_avg, 2)
            if ratio < 1.5:
                continue
            priority = "high" if ratio >= 2.0 else "medium"
            suggestions.append({
                "type": "performance_degradation",
                "priority": priority,
                "function_name": fname,
                "message": f"Avg duration increased {ratio}x in the recent half",
                "metrics": {
                    "avg_duration_first_half": round(first_avg, 2),
                    "avg_duration_second_half": round(second_avg, 2),
                    "increase_ratio": ratio,
                },
            })
        return suggestions

    def _aggregate_duration_by_function(self, collection, filters) -> Dict[str, float]:
        result = collection.aggregate.over_all(
            filters=filters,
            group_by=GroupByAggregate(prop="function_name"),
            return_metrics=Metrics("duration_ms").number(mean=True),
        )
        stats = {}
        for group in result.groups:
            fname = group.grouped_by.value
            if fname and group.properties and "duration_ms" in group.properties:
                stats[fname] = group.properties["duration_ms"].mean or 0.0
        return stats
