"""
API Router Integration

Combines all endpoint routers into a single API router.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    connections,
    analytics,
    executions,
    traces,
    functions,
    errors,
    healer,
    cache,
    widgets,
    github,
    semantic,
    ask_ai,
    saved_responses,
    suggest,
    archive,
)

api_router = APIRouter()

# [BYOD] Auth & Connection routes (no prefix overlap)
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Auth"]
)

api_router.include_router(
    connections.router,
    prefix="/connections",
    tags=["Connections"]
)

# Include all endpoint routers
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["Analytics"]
)

api_router.include_router(
    executions.router,
    prefix="/executions",
    tags=["Executions"]
)

api_router.include_router(
    traces.router,
    prefix="/traces",
    tags=["Traces"]
)

api_router.include_router(
    functions.router,
    prefix="/functions",
    tags=["Functions"]
)

api_router.include_router(
    errors.router,
    prefix="/errors",
    tags=["Errors"]
)

api_router.include_router(
    healer.router,
    prefix="/healer",
    tags=["Healer"]
)

api_router.include_router(
    cache.router,
    prefix="/cache",
    tags=["Cache"]
)

api_router.include_router(
    widgets.router,
    prefix="/widgets",
    tags=["Widgets"]
)

api_router.include_router(
    github.router,
    prefix="/github",
    tags=["GitHub"]
)

api_router.include_router(
    semantic.router,
    prefix="/semantic",
    tags=["Semantic Analysis"]
)

api_router.include_router(
    ask_ai.router,
    prefix="/ask-ai",
    tags=["Ask AI"]
)

api_router.include_router(
    saved_responses.router,
    prefix="/saved",
    tags=["Saved Responses"]
)

api_router.include_router(
    suggest.router,
    prefix="/suggest",
    tags=["Suggest"]
)

api_router.include_router(
    archive.router,
    prefix="/archive",
    tags=["Archive"]
)
