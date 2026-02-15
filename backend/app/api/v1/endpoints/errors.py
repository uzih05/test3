"""
Errors Endpoints

Provides error analysis and semantic error search.
[BYOD] Refactored: singleton -> DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional
from app.core.dependencies import get_user_weaviate_client, get_user_connection, get_openai_api_key
from app.models.connection import WeaviateConnection
from app.dashboard import ErrorService

router = APIRouter()


def _make_service(client, conn: WeaviateConnection, openai_key: str | None) -> ErrorService:
    return ErrorService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )


@router.get("")
async def get_errors(
    limit: int = Query(50, le=500, description="Maximum results"),
    function_name: Optional[str] = Query(None, description="Filter by function"),
    error_code: Optional[str] = Query(None, description="Filter by error code"),
    team: Optional[str] = Query(None, description="Filter by team"),
    time_range: Optional[int] = Query(None, description="Time range in minutes"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.get_errors(
        limit=limit, function_name=function_name,
        error_code=error_code, team=team, time_range_minutes=time_range
    )


@router.get("/search")
async def search_errors_semantic(
    q: str = Query(..., description="Error description to search"),
    limit: int = Query(10, le=50, description="Maximum results"),
    function_name: Optional[str] = Query(None, description="Filter by function"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.search_errors_semantic(query=q, limit=limit, function_name=function_name)


@router.get("/summary")
async def get_error_summary(
    time_range: int = Query(1440, description="Time range in minutes (default: 24h)"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.get_error_summary(time_range_minutes=time_range)


@router.get("/trends")
async def get_error_trends(
    time_range: int = Query(1440, description="Time range in minutes"),
    bucket: int = Query(60, description="Bucket size in minutes"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.get_error_trends(time_range_minutes=time_range, bucket_size_minutes=bucket)
