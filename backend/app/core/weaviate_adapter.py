"""
Weaviate Adapter Layer

[BYOD] Client-aware query functions.
All semantic search uses near_vector with Python-side OpenAI embedding.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

import weaviate
import weaviate.classes.query as wvc_query
from app.core.config import settings

logger = logging.getLogger(__name__)
_settings = settings


# ============================================================
# OpenAI Embedding (for self-hosted only)
# ============================================================

_openai_client_cache: dict = {}


def _embed_with_openai(text: str, api_key: str, model: str = "text-embedding-3-small") -> List[float]:
    """Embed text using OpenAI Embeddings API."""
    if api_key not in _openai_client_cache:
        from openai import OpenAI
        _openai_client_cache[api_key] = OpenAI(api_key=api_key)

    client = _openai_client_cache[api_key]
    response = client.embeddings.create(model=model, input=text)
    return response.data[0].embedding


# ============================================================
# Execution Search Adapters
# ============================================================

def search_executions(client: weaviate.WeaviateClient, limit: int = 50,
                      filters: Optional[Dict] = None,
                      sort_by: str = "timestamp_utc",
                      sort_ascending: bool = False) -> List[Dict[str, Any]]:
    """Query execution logs from Weaviate."""
    collection = client.collections.get(_settings.EXECUTION_COLLECTION_NAME)

    wv_filters = _build_execution_filters(filters)

    query = collection.query.fetch_objects(
        filters=wv_filters,
        sort=wvc_query.Sort.by_property(sort_by, ascending=sort_ascending),
        limit=limit,
    )

    return [_obj_to_dict(obj) for obj in query.objects]


def find_executions(client: weaviate.WeaviateClient,
                    filters: Optional[Dict] = None, limit: int = 50,
                    sort_by: str = "timestamp_utc",
                    sort_ascending: bool = False) -> List[Dict[str, Any]]:
    """Find executions with filters."""
    return search_executions(client, limit=limit, filters=filters,
                             sort_by=sort_by, sort_ascending=sort_ascending)


def find_recent_errors(client: weaviate.WeaviateClient,
                       minutes_ago: int = 60, limit: int = 20,
                       error_codes: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Find recent error executions."""
    filters = {"status": "ERROR"}
    time_limit = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
    filters["timestamp_utc__gte"] = time_limit

    if error_codes:
        filters["error_code"] = error_codes

    return search_executions(client, limit=limit, filters=filters,
                             sort_by="timestamp_utc", sort_ascending=False)


def find_slowest_executions(client: weaviate.WeaviateClient,
                            limit: int = 10,
                            min_duration_ms: float = 0.0) -> List[Dict[str, Any]]:
    """Find slowest executions by duration."""
    collection = client.collections.get(_settings.EXECUTION_COLLECTION_NAME)

    wv_filter = None
    if min_duration_ms > 0:
        wv_filter = wvc_query.Filter.by_property("duration_ms").greater_than(min_duration_ms)

    query = collection.query.fetch_objects(
        filters=wv_filter,
        sort=wvc_query.Sort.by_property("duration_ms", ascending=False),
        limit=limit,
    )

    return [_obj_to_dict(obj) for obj in query.objects]


def find_by_trace_id(client: weaviate.WeaviateClient,
                     trace_id: str) -> List[Dict[str, Any]]:
    """Find all spans belonging to a trace."""
    return search_executions(
        client, limit=100,
        filters={"trace_id": trace_id},
        sort_by="timestamp_utc", sort_ascending=True
    )


# ============================================================
# Function Search Adapters
# ============================================================

def search_functions(client: weaviate.WeaviateClient,
                     query: str, limit: int = 10,
                     filters: Optional[Dict] = None,
                     connection_type: str = "self_hosted",
                     openai_api_key: str | None = None,
                     ) -> List[Dict[str, Any]]:
    """
    Semantic search for functions using near_vector with Python-side OpenAI embedding.
    """
    if not openai_api_key:
        raise ValueError("OpenAI API key required for semantic search")

    collection = client.collections.get(_settings.COLLECTION_NAME)
    wv_filter = _build_simple_filters(filters) if filters else None

    query_vector = _embed_with_openai(query, openai_api_key)
    result = collection.query.near_vector(
        near_vector=query_vector,
        filters=wv_filter,
        limit=limit,
    )

    return [
        {
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "metadata": obj.metadata,
        }
        for obj in result.objects
    ]


def search_functions_hybrid(client: weaviate.WeaviateClient,
                            query: str, limit: int = 10,
                            alpha: float = 0.5,
                            filters: Optional[Dict] = None,
                            connection_type: str = "self_hosted",
                            openai_api_key: str | None = None,
                            ) -> List[Dict[str, Any]]:
    """
    Hybrid (keyword + vector) search for registered functions.
    For self-hosted, provides pre-computed vector for the vector component.
    """
    collection = client.collections.get(_settings.COLLECTION_NAME)
    wv_filter = _build_simple_filters(filters) if filters else None

    # Without OpenAI key, fall back to pure keyword search (alpha=0)
    if not openai_api_key:
        alpha = 0.0

    kwargs = dict(query=query, alpha=alpha, filters=wv_filter, limit=limit)

    if openai_api_key and alpha > 0:
        kwargs["vector"] = _embed_with_openai(query, openai_api_key)

    result = collection.query.hybrid(**kwargs)

    return [
        {
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "metadata": obj.metadata,
        }
        for obj in result.objects
    ]


def search_errors_by_message(client: weaviate.WeaviateClient,
                             query: str, limit: int = 10,
                             filters: Optional[Dict] = None,
                             connection_type: str = "self_hosted",
                             openai_api_key: str | None = None,
                             ) -> List[Dict[str, Any]]:
    """
    Semantic search for error messages using near_vector with Python-side OpenAI embedding.
    """
    if not openai_api_key:
        raise ValueError("OpenAI API key required for semantic search")

    collection = client.collections.get(_settings.EXECUTION_COLLECTION_NAME)

    base_filter = wvc_query.Filter.by_property("status").equal("ERROR")

    if filters:
        extra = _build_simple_filters(filters)
        if extra:
            base_filter = base_filter & extra

    query_vector = _embed_with_openai(query, openai_api_key)
    result = collection.query.near_vector(
        near_vector=query_vector,
        filters=base_filter,
        limit=limit,
    )

    return [
        {
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "metadata": obj.metadata,
        }
        for obj in result.objects
    ]


# ============================================================
# Status/Overview Adapters
# ============================================================

def get_db_status(client: weaviate.WeaviateClient) -> bool:
    """Check if Weaviate is ready."""
    try:
        return client.is_ready()
    except Exception:
        return False


def get_registered_functions(client: weaviate.WeaviateClient) -> List[Dict[str, Any]]:
    """Get all registered functions from Weaviate."""
    try:
        collection = client.collections.get(_settings.COLLECTION_NAME)
        result = collection.query.fetch_objects(limit=1000)
        return [obj.properties for obj in result.objects]
    except Exception as e:
        logger.warning(f"Failed to get registered functions: {e}")
        return []


def get_token_usage_stats(client: weaviate.WeaviateClient) -> Dict[str, Any]:
    """Query VectorWaveTokenUsage collection."""
    try:
        if not client.collections.exists("VectorWaveTokenUsage"):
            logger.warning("VectorWaveTokenUsage collection does not exist.")
            return {"total_tokens": 0}

        usage_col = client.collections.get("VectorWaveTokenUsage")

        total_tokens = 0
        stats = {}

        for obj in usage_col.iterator():
            props = obj.properties
            tokens = int(props.get("tokens", 0))
            category = props.get("category", "unknown")

            total_tokens += tokens
            cat_key = f"{category}_tokens"
            stats[cat_key] = stats.get(cat_key, 0) + tokens

        stats["total_tokens"] = total_tokens
        return stats
    except Exception as e:
        logger.warning(f"Failed to get token usage: {e}")
        return {"total_tokens": 0}


def analyze_trace_log(client: weaviate.WeaviateClient,
                      trace_id: str, language: str = "en",
                      openai_api_key: str | None = None) -> str:
    """
    Analyze a trace log using LLM.
    Self-contained implementation replacing vectorwave SDK's analyze_trace_log.
    """
    from app.core.llm_client import get_llm_client

    spans = find_by_trace_id(client, trace_id)

    if not spans:
        msg = f"Could not find logs for Trace ID '{trace_id}'."
        return msg if language == 'en' else f"Trace ID '{trace_id}'에 대한 로그를 찾을 수 없습니다."

    # Build execution flow text
    log_summary = "Execution Flow:\n"
    for i, span in enumerate(spans):
        status = "SUCCESS" if span.get('status') == 'SUCCESS' else "ERROR"
        log_summary += f"{i + 1}. {span.get('function_name')} [{status}] ({span.get('duration_ms')}ms)\n"

        if span.get('status') == 'ERROR':
            log_summary += f"   -> Error Code: {span.get('error_code')}\n"
            log_summary += f"   -> Message: {span.get('error_message')}\n"

    if language == 'ko':
        system_instruction = (
            "You are an AI debugger. Analyze the execution flow below. "
            "Summarize what happened, and if there was an error, pinpoint the root cause function and reason. "
            "Please respond in **Korean**."
        )
    else:
        system_instruction = (
            "You are an AI debugger. Analyze the execution flow below. "
            "Summarize what happened, and if there was an error, pinpoint the root cause function and reason. "
            "Please respond in **English**."
        )

    llm = get_llm_client(openai_api_key)
    if not llm:
        return "OpenAI API key not configured. Please set your API key in Settings."
    result = llm.chat(
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": log_summary}
        ],
        temperature=0.1
    )

    if result:
        return result
    return "Failed to generate analysis. Check OpenAI API key."


# ============================================================
# Internal Helpers
# ============================================================

def _obj_to_dict(obj) -> Dict[str, Any]:
    """Convert a Weaviate object to a flat dict."""
    result = dict(obj.properties)
    result["uuid"] = str(obj.uuid)
    return result


def _build_execution_filters(filters: Optional[Dict]) -> Optional[wvc_query.Filter]:
    """Build Weaviate filter from a dict of filter conditions."""
    if not filters:
        return None

    wv_filters = []

    for key, value in filters.items():
        if key.endswith("__gte"):
            prop = key.replace("__gte", "")
            wv_filters.append(
                wvc_query.Filter.by_property(prop).greater_or_equal(value)
            )
        elif isinstance(value, list):
            # Multiple values: OR condition
            or_filters = [
                wvc_query.Filter.by_property(key).equal(v) for v in value
            ]
            combined = or_filters[0]
            for f in or_filters[1:]:
                combined = combined | f
            wv_filters.append(combined)
        else:
            wv_filters.append(
                wvc_query.Filter.by_property(key).equal(value)
            )

    if not wv_filters:
        return None

    result = wv_filters[0]
    for f in wv_filters[1:]:
        result = result & f
    return result


def _build_simple_filters(filters: Dict) -> Optional[wvc_query.Filter]:
    """Build simple property equality filters."""
    wv_filters = []
    for key, value in filters.items():
        if value is not None:
            wv_filters.append(wvc_query.Filter.by_property(key).equal(value))

    if not wv_filters:
        return None

    result = wv_filters[0]
    for f in wv_filters[1:]:
        result = result & f
    return result


# ============================================================
# Golden Dataset Functions
# ============================================================

def get_golden_data(client: weaviate.WeaviateClient,
                    function_name: Optional[str] = None,
                    limit: int = 50) -> List[Dict[str, Any]]:
    """Query golden dataset records from VectorWaveGoldenDataset."""
    try:
        collection_name = _settings.GOLDEN_COLLECTION_NAME
        if not client.collections.exists(collection_name):
            return []

        collection = client.collections.get(collection_name)
        wv_filter = None
        if function_name:
            wv_filter = wvc_query.Filter.by_property("function_name").equal(function_name)

        result = collection.query.fetch_objects(
            filters=wv_filter,
            limit=limit,
        )
        return [_obj_to_dict(obj) for obj in result.objects]
    except Exception as e:
        logger.warning(f"Failed to get golden data: {e}")
        return []


def register_golden(client: weaviate.WeaviateClient,
                    execution_uuid: str,
                    note: str = "",
                    tags: Optional[List[str]] = None) -> Dict[str, Any]:
    """Copy an execution log to VectorWaveGoldenDataset with its vector."""
    exec_collection = client.collections.get(_settings.EXECUTION_COLLECTION_NAME)

    # Fetch the execution object including its vector
    exec_obj = exec_collection.query.fetch_object_by_id(
        execution_uuid,
        include_vector=True,
    )
    if exec_obj is None:
        raise ValueError(f"Execution {execution_uuid} not found")

    # Allowed golden properties (must match collection schema)
    GOLDEN_TEXT_PROPS = {
        "function_name", "original_uuid", "note", "registered_at",
        "status", "timestamp_utc", "span_id", "trace_id",
        "team", "error_code", "error_message", "input_preview", "output_preview",
    }
    GOLDEN_NUMBER_PROPS = {"duration_ms"}
    GOLDEN_ARRAY_PROPS = {"tags"}
    GOLDEN_ALL_PROPS = GOLDEN_TEXT_PROPS | GOLDEN_NUMBER_PROPS | GOLDEN_ARRAY_PROPS

    # Filter to only known properties
    raw_props = dict(exec_obj.properties)
    props = {k: v for k, v in raw_props.items() if k in GOLDEN_ALL_PROPS}
    props["original_uuid"] = execution_uuid
    props["note"] = note
    props["tags"] = tags or []
    props["registered_at"] = datetime.now(timezone.utc).isoformat()

    golden_collection_name = _settings.GOLDEN_COLLECTION_NAME
    if not client.collections.exists(golden_collection_name):
        from weaviate.classes.config import Property, DataType, Configure
        client.collections.create(
            name=golden_collection_name,
            properties=[
                Property(name="function_name", data_type=DataType.TEXT),
                Property(name="original_uuid", data_type=DataType.TEXT),
                Property(name="note", data_type=DataType.TEXT),
                Property(name="tags", data_type=DataType.TEXT_ARRAY),
                Property(name="registered_at", data_type=DataType.TEXT),
                Property(name="status", data_type=DataType.TEXT),
                Property(name="duration_ms", data_type=DataType.NUMBER),
                Property(name="timestamp_utc", data_type=DataType.TEXT),
                Property(name="span_id", data_type=DataType.TEXT),
                Property(name="trace_id", data_type=DataType.TEXT),
                Property(name="team", data_type=DataType.TEXT),
                Property(name="error_code", data_type=DataType.TEXT),
                Property(name="error_message", data_type=DataType.TEXT),
                Property(name="input_preview", data_type=DataType.TEXT),
                Property(name="output_preview", data_type=DataType.TEXT),
            ],
            vectorizer_config=Configure.Vectorizer.none(),
        )
        logger.info(f"Created collection {golden_collection_name}")

    golden_collection = client.collections.get(golden_collection_name)

    vector = exec_obj.vector.get("default") if exec_obj.vector else None
    golden_uuid = golden_collection.data.insert(
        properties=props,
        vector=vector,
    )

    return {"uuid": str(golden_uuid), "status": "registered"}


def delete_golden(client: weaviate.WeaviateClient,
                  golden_uuid: str) -> Dict[str, Any]:
    """Delete a golden record."""
    collection = client.collections.get(_settings.GOLDEN_COLLECTION_NAME)
    collection.data.delete_by_id(golden_uuid)
    return {"uuid": golden_uuid, "status": "deleted"}


def recommend_golden_candidates(client: weaviate.WeaviateClient,
                                function_name: str,
                                limit: int = 5,
                                connection_type: str = "self_hosted",
                                openai_api_key: str | None = None,
                                ) -> List[Dict[str, Any]]:
    """Recommend golden dataset candidates based on execution density."""
    exec_collection = client.collections.get(_settings.EXECUTION_COLLECTION_NAME)

    fn_filter = (
        wvc_query.Filter.by_property("function_name").equal(function_name) &
        wvc_query.Filter.by_property("status").equal("SUCCESS")
    )

    results = exec_collection.query.fetch_objects(
        filters=fn_filter,
        limit=limit * 3,
        include_vector=True,
    )

    if not results.objects:
        return []

    # Score by diversity: prefer objects with moderate vector distances
    candidates = []
    for obj in results.objects:
        props = dict(obj.properties)
        props["uuid"] = str(obj.uuid)
        props["candidate_type"] = "STEADY"
        candidates.append(props)

    # Return top candidates
    return candidates[:limit]


# ============================================================
# Drift Detection Functions
# ============================================================

def check_semantic_drift(client: weaviate.WeaviateClient,
                         vector: List[float],
                         function_name: str,
                         threshold: float = 0.3,
                         k: int = 5) -> Dict[str, Any]:
    """Check if a vector drifts from existing execution embeddings."""
    exec_collection = client.collections.get(_settings.EXECUTION_COLLECTION_NAME)

    fn_filter = wvc_query.Filter.by_property("function_name").equal(function_name)

    result = exec_collection.query.near_vector(
        near_vector=vector,
        filters=fn_filter,
        limit=k,
        return_metadata=wvc_query.MetadataQuery(distance=True),
    )

    if not result.objects:
        return {
            "is_drift": False,
            "avg_distance": 0.0,
            "nearest_uuid": None,
            "message": "No existing data to compare"
        }

    distances = [obj.metadata.distance for obj in result.objects if obj.metadata.distance is not None]
    avg_distance = sum(distances) / len(distances) if distances else 0.0
    nearest_uuid = str(result.objects[0].uuid)

    return {
        "is_drift": avg_distance > threshold,
        "avg_distance": round(avg_distance, 4),
        "nearest_uuid": nearest_uuid,
        "k": k,
        "threshold": threshold,
    }


def simulate_drift_check(client: weaviate.WeaviateClient,
                         text: str,
                         function_name: str,
                         threshold: float = 0.3,
                         k: int = 5,
                         connection_type: str = "self_hosted",
                         openai_api_key: str | None = None) -> Dict[str, Any]:
    """Simulate drift check by embedding text and comparing to existing data."""
    if not openai_api_key:
        raise ValueError("OpenAI API key required for drift check")
    vector = _embed_with_openai(text, openai_api_key)
    drift_result = check_semantic_drift(client, vector, function_name, threshold, k)
    drift_result["input_text"] = text
    drift_result["function_name"] = function_name
    return drift_result
