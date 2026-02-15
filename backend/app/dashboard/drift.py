"""
Drift Detection Service

Provides semantic drift detection and simulation.
"""

import logging
from typing import Dict, Any, Optional, List

import weaviate
import weaviate.classes.query as wvc_query
from weaviate.classes.aggregate import GroupByAggregate, Metrics

from app.core.config import settings
from app.core.weaviate_adapter import simulate_drift_check

logger = logging.getLogger(__name__)


class DriftService:
    """Provides drift detection functionality for the dashboard."""

    def __init__(self, client: weaviate.WeaviateClient,
                 connection_type: str = "self_hosted",
                 openai_api_key: str | None = None):
        self.client = client
        self.settings = settings
        self.connection_type = connection_type
        self.openai_api_key = openai_api_key

    def get_drift_summary(self, functions: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get drift status summary per function.
        Compares recent executions against older baseline using vector distances.
        """
        try:
            collection = self.client.collections.get(self.settings.EXECUTION_COLLECTION_NAME)

            # Get function names
            func_result = collection.aggregate.over_all(
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True,
            )

            function_names = []
            for group in func_result.groups:
                fname = group.grouped_by.value
                if fname and (not functions or fname in functions):
                    function_names.append(fname)

            items = []
            for fname in function_names:
                fn_filter = wvc_query.Filter.by_property("function_name").equal(fname)

                # Get recent executions with vectors
                recent = collection.query.fetch_objects(
                    filters=fn_filter,
                    limit=10,
                    include_vector=True,
                    sort=wvc_query.Sort.by_property("timestamp_utc", ascending=False),
                )

                if not recent.objects or len(recent.objects) < 2:
                    items.append({
                        "function_name": fname,
                        "status": "INSUFFICIENT_DATA",
                        "avg_distance": 0.0,
                        "sample_count": len(recent.objects) if recent.objects else 0,
                        "threshold": 0.3,
                    })
                    continue

                # Compare latest execution against older ones using near_vector
                latest = recent.objects[0]
                latest_vector = latest.vector.get("default") if latest.vector else None

                if not latest_vector:
                    items.append({
                        "function_name": fname,
                        "status": "NO_VECTOR",
                        "avg_distance": 0.0,
                        "sample_count": len(recent.objects),
                        "threshold": 0.3,
                    })
                    continue

                # Query neighbors excluding latest
                neighbors = collection.query.near_vector(
                    near_vector=latest_vector,
                    filters=fn_filter,
                    limit=6,
                    return_metadata=wvc_query.MetadataQuery(distance=True),
                )

                distances = []
                for obj in neighbors.objects:
                    if str(obj.uuid) != str(latest.uuid) and obj.metadata.distance is not None:
                        distances.append(obj.metadata.distance)

                avg_dist = sum(distances) / len(distances) if distances else 0.0
                threshold = 0.3
                status = "ANOMALY" if avg_dist > threshold else "NORMAL"

                items.append({
                    "function_name": fname,
                    "status": status,
                    "avg_distance": round(avg_dist, 4),
                    "sample_count": len(recent.objects),
                    "threshold": threshold,
                })

            return {
                "items": items,
                "total": len(items),
            }

        except Exception as e:
            logger.error(f"Failed to get drift summary: {e}")
            return {"items": [], "total": 0, "error": str(e)}

    def simulate(self, text: str, function_name: str,
                 threshold: float = 0.3, k: int = 5) -> Dict[str, Any]:
        """Simulate drift check with text input."""
        try:
            result = simulate_drift_check(
                self.client,
                text=text,
                function_name=function_name,
                threshold=threshold,
                k=k,
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )
            return result
        except Exception as e:
            logger.error(f"Failed to simulate drift: {e}")
            return {
                "is_drift": False,
                "avg_distance": 0.0,
                "error": str(e),
            }
