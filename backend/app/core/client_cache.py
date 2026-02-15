"""
Weaviate Client Cache

[BYOD] TTLCache-based per-connection client cache.
"""

import logging
from cachetools import TTLCache
import weaviate

logger = logging.getLogger(__name__)

# Cache: max 100 connections, 5 minute TTL
_client_cache: TTLCache = TTLCache(maxsize=100, ttl=300)


def _make_cache_key(connection) -> str:
    """Generates a cache key from connection config."""
    return f"{connection.id}"


def get_or_create_client(connection) -> weaviate.WeaviateClient:
    """
    Returns a cached or newly created Weaviate client for the given connection.
    """
    cache_key = _make_cache_key(connection)

    if cache_key in _client_cache:
        client = _client_cache[cache_key]
        if client.is_ready():
            return client
        del _client_cache[cache_key]

    if connection.connection_type == "wcs_cloud":
        client = weaviate.connect_to_weaviate_cloud(
            cluster_url=connection.host,
            auth_credentials=weaviate.auth.AuthApiKey(connection.api_key) if connection.api_key else None,
        )
    else:
        client = weaviate.connect_to_local(
            host=connection.host,
            port=connection.port,
            grpc_port=connection.grpc_port,
        )

    _client_cache[cache_key] = client
    logger.info(f"Created new Weaviate client for {connection.host}:{connection.port}")
    return client


def test_connection(connection_type: str, host: str, port: int = 8080,
                    grpc_port: int = 50051, api_key: str = None) -> bool:
    """Tests a Weaviate connection without caching."""
    try:
        if connection_type == "wcs_cloud":
            client = weaviate.connect_to_weaviate_cloud(
                cluster_url=host,
                auth_credentials=weaviate.auth.AuthApiKey(api_key) if api_key else None,
            )
        else:
            client = weaviate.connect_to_local(
                host=host,
                port=port,
                grpc_port=grpc_port,
            )

        is_ready = client.is_ready()
        client.close()
        return is_ready
    except Exception as e:
        logger.warning(f"Connection test failed: {e}")
        return False
