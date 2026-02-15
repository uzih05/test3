"""
Analytics Endpoints

Provides KPI metrics, timelines, and overview data for the dashboard.
[BYOD] Refactored: singleton → DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from app.core.dependencies import get_user_weaviate_client
from app.dashboard import DashboardOverviewService

router = APIRouter()


@router.get("/status")
async def get_system_status(client=Depends(get_user_weaviate_client)):
    service = DashboardOverviewService(client=client)
    return service.get_system_status()


@router.get("/kpi")
async def get_kpi_metrics(
    range: int = Query(60, alias="range", description="Time range in minutes"),
    client=Depends(get_user_weaviate_client),
):
    service = DashboardOverviewService(client=client)
    return service.get_kpi_metrics(time_range_minutes=range)


@router.get("/tokens")
async def get_token_usage(client=Depends(get_user_weaviate_client)):
    service = DashboardOverviewService(client=client)
    return service.get_token_usage()


@router.get("/timeline")
async def get_execution_timeline(
    range: int = Query(60, description="Time range in minutes"),
    bucket: int = Query(5, description="Bucket size in minutes"),
    client=Depends(get_user_weaviate_client),
):
    service = DashboardOverviewService(client=client)
    return service.get_execution_timeline(
        time_range_minutes=range,
        bucket_size_minutes=bucket
    )


@router.get("/distribution/functions")
async def get_function_distribution(
    limit: int = Query(10, description="Maximum number of functions"),
    client=Depends(get_user_weaviate_client),
):
    service = DashboardOverviewService(client=client)
    return service.get_function_distribution(limit=limit)


@router.get("/distribution/errors")
async def get_error_code_distribution(
    range: int = Query(1440, description="Time range in minutes (default: 24h)"),
    client=Depends(get_user_weaviate_client),
):
    service = DashboardOverviewService(client=client)
    return service.get_error_code_distribution(time_range_minutes=range)
