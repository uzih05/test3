"""
Traces Endpoints

Provides distributed tracing and workflow visualization.
[BYOD] Refactored: singleton -> DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from app.core.dependencies import get_user_weaviate_client, get_openai_api_key
from app.dashboard import TraceService

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
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = TraceService(client=client)
    return service.analyze_trace(trace_id=trace_id, language=language, openai_api_key=openai_key)
