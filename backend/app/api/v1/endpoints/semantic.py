"""
Semantic Analysis Endpoints

Vector-based analytics: scatter, bottleneck, coverage, hallucinations, error clusters.
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional

from app.core.dependencies import get_user_weaviate_client, get_openai_api_key
from app.dashboard import SemanticAnalysisService

router = APIRouter()


@router.get("/scatter")
async def get_input_scatter(
    function_name: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """2D scatter plot of execution vectors via PCA."""
    service = SemanticAnalysisService(client=client, openai_api_key=openai_key)
    return service.get_input_scatter(function_name=function_name, limit=limit)


@router.get("/bottleneck")
async def get_bottleneck_clusters(
    function_name: Optional[str] = Query(None),
    n_clusters: int = Query(5, ge=2, le=20),
    limit: int = Query(300, le=1000),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """KMeans clustering of execution vectors with latency analysis."""
    service = SemanticAnalysisService(client=client, openai_api_key=openai_key)
    return service.get_bottleneck_clusters(
        function_name=function_name, n_clusters=n_clusters, limit=limit
    )


@router.get("/coverage")
async def get_golden_coverage(
    function_name: Optional[str] = Query(None),
    limit: int = Query(500, le=2000),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """Golden dataset coverage analysis with 2D scatter."""
    service = SemanticAnalysisService(client=client, openai_api_key=openai_key)
    return service.get_golden_coverage(function_name=function_name, limit=limit)


@router.get("/hallucinations")
async def get_hallucination_candidates(
    function_name: Optional[str] = Query(None),
    threshold: float = Query(0.3, ge=0.0, le=1.0),
    limit: int = Query(20, le=100),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """Detect SUCCESS executions with abnormal vector distances."""
    service = SemanticAnalysisService(client=client, openai_api_key=openai_key)
    return service.get_hallucination_candidates(
        function_name=function_name, threshold=threshold, limit=limit
    )


@router.get("/error-clusters")
async def get_error_clusters(
    n_clusters: int = Query(5, ge=2, le=20),
    limit: int = Query(200, le=1000),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """Cluster ERROR executions by semantic similarity."""
    service = SemanticAnalysisService(client=client, openai_api_key=openai_key)
    return service.get_error_clusters(n_clusters=n_clusters, limit=limit)


@router.get("/recommend/{function_name}")
async def recommend_with_diversity(
    function_name: str,
    limit: int = Query(10, le=50),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """Recommend golden candidates with Discovery/Steady diversity."""
    service = SemanticAnalysisService(client=client, openai_api_key=openai_key)
    candidates = service.recommend_with_diversity(function_name=function_name, limit=limit)
    return {
        "function_name": function_name,
        "candidates": candidates,
        "total": len(candidates),
    }
