"""
Executions Endpoints

Provides execution log querying with filtering and pagination.
[BYOD] Refactored: singleton → DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional
from app.core.dependencies import get_user_weaviate_client
from app.dashboard import ExecutionService

router = APIRouter()


@router.get("")
async def get_executions(
    limit: int = Query(50, le=500, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    status: Optional[str] = Query(None, description="Filter: SUCCESS, ERROR, CACHE_HIT"),
    function_name: Optional[str] = Query(None, description="Filter by function name"),
    team: Optional[str] = Query(None, description="Filter by team"),
    error_code: Optional[str] = Query(None, description="Filter by error code"),
    time_range: Optional[int] = Query(None, description="Time range in minutes"),
    sort_by: str = Query("timestamp_utc", description="Sort field"),
    sort_asc: bool = Query(False, description="Sort ascending"),
    client=Depends(get_user_weaviate_client),
):
    service = ExecutionService(client=client)
    return service.get_executions(
        limit=limit, offset=offset, status=status,
        function_name=function_name, team=team, error_code=error_code,
        time_range_minutes=time_range, sort_by=sort_by, sort_ascending=sort_asc
    )


@router.get("/recent-errors")
async def get_recent_errors(
    minutes: int = Query(60, description="Time range in minutes"),
    limit: int = Query(20, le=100, description="Maximum results"),
    error_codes: Optional[str] = Query(None, description="Comma-separated error codes"),
    client=Depends(get_user_weaviate_client),
):
    service = ExecutionService(client=client)
    codes = error_codes.split(",") if error_codes else None
    return service.get_recent_errors(minutes_ago=minutes, limit=limit, error_codes=codes)


@router.get("/slowest")
async def get_slowest_executions(
    limit: int = Query(10, le=50, description="Maximum results"),
    min_duration: float = Query(0.0, description="Minimum duration in ms"),
    client=Depends(get_user_weaviate_client),
):
    service = ExecutionService(client=client)
    return service.get_slowest_executions(limit=limit, min_duration_ms=min_duration)


@router.get("/{span_id}")
async def get_execution_by_id(
    span_id: str,
    client=Depends(get_user_weaviate_client),
):
    service = ExecutionService(client=client)
    result = service.get_execution_by_id(span_id)
    if result is None:
        return {"error": "Execution not found", "span_id": span_id}
    return result
