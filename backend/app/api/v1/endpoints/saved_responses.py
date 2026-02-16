"""
Saved Responses Endpoints

CRUD operations for AI Q&A history.
Auto-saved by Ask AI / Healer. Bookmark for favorites.
Free: 24h viewing limit. Pro: unlimited.
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.saved_response import SavedResponse

router = APIRouter()

FREE_HISTORY_HOURS = 24


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
    """Save an AI Q&A pair (auto-saved, no plan restriction)."""
    saved = SavedResponse(
        user_id=user.id,
        question=request.question,
        answer=request.answer,
        source_type=request.source_type,
        function_name=request.function_name,
        is_bookmarked=False,
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
    bookmarked: bool | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List saved responses with filtering, pagination, and plan-based access."""
    query = select(SavedResponse).where(SavedResponse.user_id == user.id)

    if source_type:
        query = query.where(SavedResponse.source_type == source_type)
    if function_name:
        query = query.where(SavedResponse.function_name == function_name)
    if bookmarked is not None:
        query = query.where(SavedResponse.is_bookmarked == bookmarked)
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

    # Free plan: mark items older than 24h as locked
    is_pro = user.plan == "pro"
    cutoff = datetime.now(timezone.utc) - timedelta(hours=FREE_HISTORY_HOURS)

    response_items = []
    for item in items:
        created = item.created_at
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        locked = not is_pro and created is not None and created < cutoff

        response_items.append({
            "id": item.id,
            "question": item.question,
            "answer": item.answer if not locked else "",
            "source_type": item.source_type,
            "function_name": item.function_name,
            "is_bookmarked": item.is_bookmarked,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "locked": locked,
        })

    return {
        "items": response_items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/{response_id}/bookmark")
async def toggle_bookmark(
    response_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle bookmark status on a saved response."""
    result = await db.execute(
        select(SavedResponse).where(
            SavedResponse.id == response_id,
            SavedResponse.user_id == user.id,
        )
    )
    saved = result.scalar_one_or_none()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved response not found")

    saved.is_bookmarked = not saved.is_bookmarked
    saved_id = saved.id
    new_bookmark_state = saved.is_bookmarked
    await db.commit()
    return {"id": saved_id, "is_bookmarked": new_bookmark_state}


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
