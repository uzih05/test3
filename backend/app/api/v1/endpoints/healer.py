"""
Healer Endpoints

Provides AI-powered bug diagnosis and fix suggestions.
[BYOD] Refactored: singleton -> DI (Depends)
"""

from fastapi import APIRouter, Query, Depends, HTTPException
from typing import List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_weaviate_client, get_user_connection, get_openai_api_key
from app.models.user import User
from app.models.connection import WeaviateConnection
from app.dashboard import HealerService
from app.services.plan_service import check_can_use_ai, increment_usage

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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    if not await check_can_use_ai(db, user):
        raise HTTPException(status_code=429, detail="Daily AI usage limit reached. Upgrade to Pro for unlimited access.")

    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    result = service.diagnose_and_heal(
        function_name=request.function_name,
        lookback_minutes=request.lookback_minutes,
        openai_api_key=openai_key,
    )

    if result.get("status") == "success":
        await increment_usage(db, user.id)

    return result


@router.post("/diagnose/batch")
async def batch_diagnose(
    request: BatchDiagnoseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    if not await check_can_use_ai(db, user):
        raise HTTPException(status_code=429, detail="Daily AI usage limit reached. Upgrade to Pro for unlimited access.")

    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    result = await service.batch_diagnose_async(
        function_names=request.function_names,
        lookback_minutes=request.lookback_minutes,
        openai_api_key=openai_key,
    )

    succeeded = result.get("succeeded", 0)
    if succeeded > 0:
        for _ in range(succeeded):
            await increment_usage(db, user.id)

    return result


@router.get("/diagnose/{function_name}")
async def diagnose_function(
    function_name: str,
    lookback: int = Query(60, description="Lookback time in minutes"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    if not await check_can_use_ai(db, user):
        raise HTTPException(status_code=429, detail="Daily AI usage limit reached. Upgrade to Pro for unlimited access.")

    service = HealerService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )
    result = service.diagnose_and_heal(
        function_name=function_name,
        lookback_minutes=lookback,
        openai_api_key=openai_key,
    )

    if result.get("status") == "success":
        await increment_usage(db, user.id)

    return result
