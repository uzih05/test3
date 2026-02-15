"""
Functions Endpoints

Provides registered function metadata and search.
[BYOD] Refactored: singleton -> DI (Depends)
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional
from app.core.dependencies import get_user_weaviate_client, get_user_connection, get_openai_api_key
from app.models.connection import WeaviateConnection
from app.dashboard import FunctionService

router = APIRouter()


def _make_service(client, conn: WeaviateConnection, openai_key: str | None) -> FunctionService:
    return FunctionService(
        client=client,
        connection_type=conn.connection_type,
        openai_api_key=openai_key,
    )


@router.get("")
async def get_all_functions(
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.get_all_functions()


@router.get("/search")
async def search_functions(
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, le=50, description="Maximum results"),
    team: Optional[str] = Query(None, description="Filter by team"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    filters = {"team": team} if team else None
    return service.search_functions_semantic(query=q, limit=limit, filters=filters)


@router.get("/search/hybrid")
async def search_functions_hybrid(
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, le=50, description="Maximum results"),
    alpha: float = Query(0.5, ge=0, le=1, description="0=keyword, 1=vector"),
    team: Optional[str] = Query(None, description="Filter by team"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    filters = {"team": team} if team else None
    return service.search_functions_hybrid_mode(query=q, limit=limit, alpha=alpha, filters=filters)


@router.get("/ask")
async def ask_about_function(
    q: str = Query(..., description="Question about a function"),
    language: str = Query("en", description="Response language: 'en' or 'ko'"),
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.ask_about_function(query=q, language=language, openai_api_key=openai_key)


@router.get("/by-team/{team}")
async def get_functions_by_team(
    team: str,
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    return service.get_functions_by_team(team=team)


@router.get("/{function_name}")
async def get_function_by_name(
    function_name: str,
    client=Depends(get_user_weaviate_client),
    conn: WeaviateConnection = Depends(get_user_connection),
    openai_key: str | None = Depends(get_openai_api_key),
):
    service = _make_service(client, conn, openai_key)
    result = service.get_function_by_name(function_name)
    if result is None:
        return {"error": "Function not found", "function_name": function_name}
    return result
