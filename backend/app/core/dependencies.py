"""
FastAPI Dependencies

[BYOD] get_current_user, get_user_weaviate_client
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.encryption import decrypt_value
from app.core.client_cache import get_or_create_client
from app.models.user import User
from app.models.connection import WeaviateConnection
from app.models.user_connection_key import UserConnectionKey

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extracts and validates the current user from JWT token."""
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_user_weaviate_client(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the Weaviate client for the user's active connection."""
    result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.user_id == user.id,
            WeaviateConnection.is_active == True,
        )
    )
    connection = result.scalar_one_or_none()

    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active Weaviate connection. Please add one in Settings.",
        )

    try:
        client = get_or_create_client(connection)
        return client
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to Weaviate: {str(e)}",
        )


async def get_user_connection(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeaviateConnection:
    """Returns the user's active WeaviateConnection (for vectorizer config etc.)."""
    result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.user_id == user.id,
            WeaviateConnection.is_active == True,
        )
    )
    connection = result.scalar_one_or_none()

    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active Weaviate connection. Please add one in Settings.",
        )
    return connection


async def get_openai_api_key(
    user: User = Depends(get_current_user),
    conn: WeaviateConnection = Depends(get_user_connection),
    db: AsyncSession = Depends(get_db),
) -> str | None:
    """Resolve OpenAI API key: per-connection first, then user fallback."""
    result = await db.execute(
        select(UserConnectionKey).where(
            UserConnectionKey.user_id == user.id,
            UserConnectionKey.connection_id == conn.id,
        )
    )
    uck = result.scalar_one_or_none()
    if uck and uck.openai_api_key:
        return decrypt_value(uck.openai_api_key)
    if user.openai_api_key:
        return decrypt_value(user.openai_api_key)
    return None
