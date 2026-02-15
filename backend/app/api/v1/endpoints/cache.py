"""
Cache Endpoints

Provides cache analytics, golden dataset management, and drift detection.
[BYOD] Refactored: DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from typing import List, Optional
from pydantic import BaseModel

from app.core.dependencies import get_user_weaviate_client, get_user_connection, get_openai_api_key
from app.models.connection import WeaviateConnection
from app.dashboard import CacheService, GoldenDatasetService, DriftService

router = APIRouter()


class GoldenRegisterRequest(BaseModel):
    execution_uuid: str
    note: str = ""
    tags: List[str] = []


class DriftSimulateRequest(BaseModel):
    text: str
    function_name: str
    threshold: float = 0.3
    k: int = 5


# ============ Cache Analytics ============

@router.get("/analytics")
async def get_cache_analytics(
    range: int = Query(60, description="Time range in minutes"),
    client=Depends(get_user_weaviate_client),
):
    service = CacheService(client=client)
    return service.get_cache_analytics(time_range_minutes=range)


# ============ Golden Dataset ============

@router.get("/golden")
async def list_golden(
    function_name: Optional[str] = Query(None),
    limit: int = Query(50),
    client=Depends(get_user_weaviate_client),
):
    service = GoldenDatasetService(client=client)
    return service.list_golden(function_name=function_name, limit=limit)


@router.post("/golden")
async def register_golden(
    request: GoldenRegisterRequest,
    client=Depends(get_user_weaviate_client),
):
    service = GoldenDatasetService(client=client)
    return service.register(
        execution_uuid=request.execution_uuid,
        note=request.note,
        tags=request.tags,
    )


@router.delete("/golden/{uuid}")
async def delete_golden(
    uuid: str,
    client=Depends(get_user_weaviate_client),
):
    service = GoldenDatasetService(client=client)
    return service.delete(golden_uuid=uuid)


@router.get("/golden/recommend/{function_name}")
async def recommend_golden_candidates(
    function_name: str,
    limit: int = Query(5),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = GoldenDatasetService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    return service.recommend_candidates(function_name=function_name, limit=limit)


@router.get("/golden/stats")
async def get_golden_stats(
    client=Depends(get_user_weaviate_client),
):
    service = GoldenDatasetService(client=client)
    return service.get_golden_stats()


# ============ Drift Detection ============

@router.get("/drift/summary")
async def get_drift_summary(
    client=Depends(get_user_weaviate_client),
):
    service = DriftService(client=client)
    return service.get_drift_summary()


@router.post("/drift/simulate")
async def simulate_drift(
    request: DriftSimulateRequest,
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = DriftService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    return service.simulate(
        text=request.text,
        function_name=request.function_name,
        threshold=request.threshold,
        k=request.k,
    )
