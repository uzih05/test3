"""
Healer Endpoints

Provides AI-powered bug diagnosis and fix suggestions.
[BYOD] Refactored: singleton -> DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from typing import List
from pydantic import BaseModel
from app.core.dependencies import get_user_weaviate_client, get_user_connection, get_openai_api_key
from app.models.connection import WeaviateConnection
from app.dashboard import HealerService

router = APIRouter()


class DiagnoseRequest(BaseModel):
    function_name: str
    lookback_minutes: int = 60


class BatchDiagnoseRequest(BaseModel):
    function_names: List[str]
    lookback_minutes: int = 60


@router.get("/functions")
async def get_healable_functions(
    time_range: int = Query(1440, description="Time range in minutes (default: 24h)"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    return service.get_healable_functions(time_range_minutes=time_range)


@router.post("/diagnose")
async def diagnose_and_heal(
    request: DiagnoseRequest,
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    return service.diagnose_and_heal(
        function_name=request.function_name,
        lookback_minutes=request.lookback_minutes,
        openai_api_key=openai_key,
    )


@router.post("/diagnose/batch")
async def batch_diagnose(
    request: BatchDiagnoseRequest,
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    return await service.batch_diagnose_async(
        function_names=request.function_names,
        lookback_minutes=request.lookback_minutes,
        openai_api_key=openai_key,
    )


@router.get("/diagnose/{function_name}")
async def diagnose_function(
    function_name: str,
    lookback: int = Query(60, description="Lookback time in minutes"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    return service.diagnose_and_heal(
        function_name=function_name,
        lookback_minutes=lookback,
        openai_api_key=openai_key,
    )
