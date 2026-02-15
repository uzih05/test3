"""
Golden Dataset Service

Manages golden dataset records: list, register, delete, recommend candidates.
"""

import logging
from typing import Dict, Any, Optional, List

import weaviate
from weaviate.classes.aggregate import GroupByAggregate

from app.core.config import settings
from app.core.weaviate_adapter import (
    get_golden_data,
    register_golden,
    delete_golden,
    recommend_golden_candidates,
)

logger = logging.getLogger(__name__)


class GoldenDatasetService:
    """Manages golden dataset operations for the dashboard."""

    def __init__(self, client: weaviate.WeaviateClient,
                 connection_type: str = "self_hosted",
                 openai_api_key: str | None = None):
        self.client = client
        self.settings = settings
        self.connection_type = connection_type
        self.openai_api_key = openai_api_key

    def list_golden(self, function_name: Optional[str] = None,
                    limit: int = 50) -> Dict[str, Any]:
        """List golden dataset records."""
        try:
            items = get_golden_data(self.client, function_name=function_name, limit=limit)
            return {
                "items": items,
                "total": len(items),
            }
        except Exception as e:
            logger.error(f"Failed to list golden data: {e}")
            return {"items": [], "total": 0, "error": str(e)}

    def register(self, execution_uuid: str, note: str = "",
                 tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """Register an execution log as golden data."""
        try:
            result = register_golden(self.client, execution_uuid, note, tags)
            return result
        except Exception as e:
            logger.error(f"Failed to register golden: {e}")
            return {"status": "error", "error": str(e)}

    def delete(self, golden_uuid: str) -> Dict[str, Any]:
        """Delete a golden record."""
        try:
            result = delete_golden(self.client, golden_uuid)
            return result
        except Exception as e:
            logger.error(f"Failed to delete golden: {e}")
            return {"status": "error", "error": str(e)}

    def recommend_candidates(self, function_name: str,
                             limit: int = 5) -> Dict[str, Any]:
        """Recommend golden dataset candidates based on execution density."""
        try:
            candidates = recommend_golden_candidates(
                self.client,
                function_name=function_name,
                limit=limit,
                connection_type=self.connection_type,
                openai_api_key=self.openai_api_key,
            )
            return {
                "function_name": function_name,
                "candidates": candidates,
                "total": len(candidates),
            }
        except Exception as e:
            logger.error(f"Failed to recommend candidates: {e}")
            return {
                "function_name": function_name,
                "candidates": [],
                "total": 0,
                "error": str(e),
            }

    def get_golden_stats(self) -> Dict[str, Any]:
        """Get golden dataset stats grouped by function name."""
        try:
            collection_name = self.settings.GOLDEN_COLLECTION_NAME
            if not self.client.collections.exists(collection_name):
                return {"stats": [], "total": 0}

            collection = self.client.collections.get(collection_name)
            result = collection.aggregate.over_all(
                group_by=GroupByAggregate(prop="function_name"),
                total_count=True,
            )

            stats = []
            total = 0
            for group in result.groups:
                fname = group.grouped_by.value
                count = group.total_count or 0
                if fname:
                    stats.append({"function_name": fname, "count": count})
                    total += count

            stats.sort(key=lambda x: x["count"], reverse=True)
            return {"stats": stats, "total": total}

        except Exception as e:
            logger.error(f"Failed to get golden stats: {e}")
            return {"stats": [], "total": 0, "error": str(e)}
