"""
Traces Endpoints

Provides distributed tracing and workflow visualization.
[BYOD] Refactored: singleton -> DI (Depends)
"""

import logging
import uuid as _uuid

from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_weaviate_client, get_openai_api_key
from app.dashboard import TraceService
from app.models.user import User
from app.models.saved_response import SavedResponse
from app.services.plan_service import check_can_use_ai, increment_usage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def get_recent_traces(
    limit: int = Query(20, le=100, description="Maximum traces"),
    client=Depends(get_user_weaviate_client),
):
    service = TraceService(client=client)
    return service.get_recent_traces(limit=limit)


@router.get("/{trace_id}")
async def get_trace(trace_id: str, client=Depends(get_user_weaviate_client)):
    service = TraceService(client=client)
    return service.get_trace(trace_id)


@router.get("/{trace_id}/tree")
async def get_trace_tree(trace_id: str, client=Depends(get_user_weaviate_client)):
    service = TraceService(client=client)
    trace = service.get_trace(trace_id)

    if trace["status"] == "NOT_FOUND":
        return {"trace_id": trace_id, "tree": [], "error": "Trace not found"}

    tree = service.build_span_tree(trace["spans"])

    return {
        "trace_id": trace_id,
        "tree": tree,
        "total_duration_ms": trace["total_duration_ms"],
        "status": trace["status"]
    }


@router.get("/{trace_id}/analyze")
async def analyze_trace(
    trace_id: str,
    language: str = Query("en", description="Response language: 'en' or 'ko'"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    if not await check_can_use_ai(db, user):
        raise HTTPException(status_code=429, detail="Daily AI usage limit reached.")

    service = TraceService(client=client)
    result = service.analyze_trace(trace_id=trace_id, language=language, openai_api_key=openai_key)

    await increment_usage(db, user.id)

    # Auto-save
    try:
        saved_id = str(_uuid.uuid4())
        saved = SavedResponse(
            id=saved_id,
            user_id=user.id,
            question=f"[Trace Analysis] {trace_id}",
            answer=result.get("analysis", ""),
            source_type="trace_analysis",
            function_name=None,
            is_bookmarked=False,
        )
        db.add(saved)
        await db.commit()
        result["saved_id"] = saved_id
    except Exception as e:
        logger.warning(f"Failed to auto-save trace analysis: {e}")

    return result
