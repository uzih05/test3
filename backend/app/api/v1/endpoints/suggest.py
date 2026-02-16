"""
Suggest Endpoints

Provides data-driven suggestions based on execution analytics.
"""

from fastapi import APIRouter, Query, Depends
from app.core.dependencies import get_user_weaviate_client
from app.dashboard import SuggestService

router = APIRouter()


@router.get("/")
async def get_suggestions(
    range: int = Query(1440, description="Time range in minutes"),
    client=Depends(get_user_weaviate_client),
):
    service = SuggestService(client=client)
    return service.get_suggestions(time_range_minutes=range)
