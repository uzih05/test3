"""
Authentication Endpoints

[BYOD] Signup, Login, Get current user
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.encryption import encrypt_value
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.connection import WeaviateConnection
from app.models.user_connection_key import UserConnectionKey

router = APIRouter()


# ============ Request/Response Models ============

class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    created_at: str


class ApiKeyRequest(BaseModel):
    openai_api_key: str | None = None


class PlanUpdateRequest(BaseModel):
    plan: str  # "free" or "pro"


# ============ Endpoints ============

@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        display_name=request.display_name or request.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
        },
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and receive JWT token."""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
        },
    )


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user."""
    has_key = bool(user.openai_api_key)

    # Check active connection's per-connection key
    conn_result = await db.execute(
        select(WeaviateConnection).where(
            WeaviateConnection.user_id == user.id,
            WeaviateConnection.is_active == True,
        )
    )
    conn = conn_result.scalar_one_or_none()
    if conn:
        uck_result = await db.execute(
            select(UserConnectionKey).where(
                UserConnectionKey.user_id == user.id,
                UserConnectionKey.connection_id == conn.id,
                UserConnectionKey.openai_api_key.isnot(None),
            )
        )
        if uck_result.scalar_one_or_none():
            has_key = True

    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "has_openai_key": has_key,
        "plan": user.plan,
    }


@router.put("/api-key")
async def update_api_key(
    request: ApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or delete the user's OpenAI API key (encrypted)."""
    if request.openai_api_key:
        user.openai_api_key = encrypt_value(request.openai_api_key)
    else:
        user.openai_api_key = None

    await db.commit()
    return {"status": "saved", "has_key": bool(user.openai_api_key)}


@router.get("/plan")
async def get_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's plan info and daily AI usage."""
    from app.services.plan_service import get_plan_info
    return await get_plan_info(db, user)


@router.put("/plan")
async def update_plan(
    request: PlanUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's plan (no payment processing yet)."""
    if request.plan not in ("free", "pro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan must be 'free' or 'pro'",
        )
    user.plan = request.plan
    await db.commit()
    return {"status": "updated", "plan": user.plan}
