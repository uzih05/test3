"""
Connection CRUD Endpoints

[BYOD] Manage Weaviate connections per user.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.client_cache import test_connection
from app.core.encryption import encrypt_value
from app.models.user import User
from app.models.connection import WeaviateConnection
from app.models.user_connection_key import UserConnectionKey

router = APIRouter()


# ============ Request/Response Models ============

class ConnectionCreate(BaseModel):
    name: str = "Default"
    connection_type: str = "self_hosted"  # "self_hosted" or "wcs_cloud"
    host: str = "localhost"
    port: int = 8080
    grpc_port: int = 50051
    api_key: str | None = None
    vectorizer_type: str | None = None  # "huggingface" or "openai" (required for wcs_cloud)
    vectorizer_model: str | None = None


class ConnectionUpdate(BaseModel):
    name: str | None = None
    connection_type: str | None = None
    host: str | None = None
    port: int | None = None
    grpc_port: int | None = None
    api_key: str | None = None
    vectorizer_type: str | None = None
    vectorizer_model: str | None = None


class ConnectionTestRequest(BaseModel):
    connection_type: str = "self_hosted"
    host: str = "localhost"
    port: int = 8080
    grpc_port: int = 50051
    api_key: str | None = None


class ConnectionApiKeyRequest(BaseModel):
    openai_api_key: str


# ============ Endpoints ============

@router.get("")
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all connections for the current user."""
    result = await db.execute(
        select(WeaviateConnection)
        .where(WeaviateConnection.user_id == user.id)
        .order_by(WeaviateConnection.created_at.desc())
    )
    connections = result.scalars().all()

    # Check which connections have per-connection API keys
    conn_ids = [c.id for c in connections]
    key_result = await db.execute(
        select(UserConnectionKey.connection_id).where(
            UserConnectionKey.user_id == user.id,
            UserConnectionKey.connection_id.in_(conn_ids),
            UserConnectionKey.openai_api_key.isnot(None),
        )
    )
    has_key_set = set(key_result.scalars().all())
    has_user_key = bool(user.openai_api_key)

    return {
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "connection_type": c.connection_type,
                "host": c.host,
                "port": c.port,
                "grpc_port": c.grpc_port,
                "api_key": "***" if c.api_key else None,
                "is_active": c.is_active,
                "vectorizer_type": c.vectorizer_type,
                "vectorizer_model": c.vectorizer_model,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "has_openai_key": c.id in has_key_set or has_user_key,
            }
            for c in connections
        ],
        "total": len(connections),
    }


@router.post("")
async def create_connection(
    request: ConnectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new Weaviate connection."""
    connection = WeaviateConnection(
        user_id=user.id,
        name=request.name,
        connection_type=request.connection_type,
        host=request.host,
        port=request.port,
        grpc_port=request.grpc_port,
        api_key=request.api_key,
        vectorizer_type=request.vectorizer_type,
        vectorizer_model=request.vectorizer_model,
        is_active=False,
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    return {
        "id": connection.id,
        "name": connection.name,
        "connection_type": connection.connection_type,
        "host": connection.host,
        "port": connection.port,
        "grpc_port": connection.grpc_port,
        "is_active": connection.is_active,
        "vectorizer_type": connection.vectorizer_type,
        "vectorizer_model": connection.vectorizer_model,
    }


@router.put("/{connection_id}")
async def update_connection(
    connection_id: str,
    request: ConnectionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing connection."""
    result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.id == connection_id,
            WeaviateConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(connection, key, value)

    await db.commit()
    await db.refresh(connection)

    return {"status": "updated", "id": connection.id}


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a connection."""
    result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.id == connection_id,
            WeaviateConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    await db.delete(connection)
    await db.commit()

    return {"status": "deleted", "id": connection_id}


@router.post("/{connection_id}/activate")
async def activate_connection(
    connection_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a connection as the active one (deactivates others)."""
    # Verify connection exists and belongs to user
    result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.id == connection_id,
            WeaviateConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Deactivate all user connections
    await db.execute(
        update(WeaviateConnection)
        .where(WeaviateConnection.user_id == user.id)
        .values(is_active=False)
    )

    # Activate the selected one
    connection.is_active = True
    await db.commit()

    return {"status": "activated", "id": connection_id}


@router.post("/test")
async def test_connection_endpoint(
    request: ConnectionTestRequest,
    user: User = Depends(get_current_user),
):
    """Test a Weaviate connection without saving."""
    success = test_connection(
        connection_type=request.connection_type,
        host=request.host,
        port=request.port,
        grpc_port=request.grpc_port,
        api_key=request.api_key,
    )

    return {
        "success": success,
        "message": "Connection successful" if success else "Connection failed",
    }


# ============ Per-Connection API Key ============

@router.put("/{connection_id}/api-key")
async def set_connection_api_key(
    connection_id: str,
    request: ConnectionApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save OpenAI API key for a specific connection (encrypted)."""
    # Verify connection exists and belongs to user
    result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.id == connection_id,
            WeaviateConnection.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Connection not found")

    # Upsert user_connection_key
    result = await db.execute(
        select(UserConnectionKey).where(
            UserConnectionKey.user_id == user.id,
            UserConnectionKey.connection_id == connection_id,
        )
    )
    uck = result.scalar_one_or_none()

    if uck:
        uck.openai_api_key = encrypt_value(request.openai_api_key)
    else:
        uck = UserConnectionKey(
            user_id=user.id,
            connection_id=connection_id,
            openai_api_key=encrypt_value(request.openai_api_key),
        )
        db.add(uck)

    await db.commit()
    return {"status": "saved", "has_key": True}


@router.delete("/{connection_id}/api-key")
async def delete_connection_api_key(
    connection_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete OpenAI API key for a specific connection."""
    result = await db.execute(
        select(UserConnectionKey).where(
            UserConnectionKey.user_id == user.id,
            UserConnectionKey.connection_id == connection_id,
        )
    )
    uck = result.scalar_one_or_none()

    if uck:
        uck.openai_api_key = None
        await db.commit()

    return {"status": "deleted", "has_key": False}
