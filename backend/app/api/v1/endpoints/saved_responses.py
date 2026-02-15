"""
Saved Responses Endpoints

CRUD operations for saved AI Q&A pairs (Pro feature).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.saved_response import SavedResponse

router = APIRouter()


class SaveResponseRequest(BaseModel):
    question: str
    answer: str
    source_type: str
    function_name: str | None = None


@router.post("/")
async def save_response(
    request: SaveResponseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save an AI Q&A pair (Pro only)."""
    if user.plan != "pro":
        raise HTTPException(
            status_code=403,
            detail="Saved Responses is a Pro feature. Upgrade to save AI responses.",
        )

    saved = SavedResponse(
        user_id=user.id,
        question=request.question,
        answer=request.answer,
        source_type=request.source_type,
        function_name=request.function_name,
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return {"id": saved.id, "status": "saved"}


@router.get("/")
async def list_saved_responses(
    source_type: str | None = Query(None),
    function_name: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List saved responses with filtering and pagination."""
    query = select(SavedResponse).where(SavedResponse.user_id == user.id)

    if source_type:
        query = query.where(SavedResponse.source_type == source_type)
    if function_name:
        query = query.where(SavedResponse.function_name == function_name)
    if search:
        query = query.where(
            SavedResponse.question.ilike(f"%{search}%")
            | SavedResponse.answer.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(SavedResponse.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": item.id,
                "question": item.question,
                "answer": item.answer,
                "source_type": item.source_type,
                "function_name": item.function_name,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.delete("/{response_id}")
async def delete_saved_response(
    response_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved response."""
    result = await db.execute(
        select(SavedResponse).where(
            SavedResponse.id == response_id,
            SavedResponse.user_id == user.id,
        )
    )
    saved = result.scalar_one_or_none()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved response not found")

    await db.delete(saved)
    await db.commit()
    return {"status": "deleted"}
