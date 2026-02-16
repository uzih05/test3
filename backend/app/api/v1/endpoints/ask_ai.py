"""
Ask AI Endpoints

Comprehensive AI Q&A service using monitored function data as context.
Auto-saves responses to history.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_user_weaviate_client, get_openai_api_key
from app.models.user import User
from app.models.saved_response import SavedResponse
from app.dashboard import AskAiService
from app.services.plan_service import check_can_use_ai, increment_usage

logger = logging.getLogger(__name__)

router = APIRouter()


class AskRequest(BaseModel):
    question: str
    function_name: str | None = None


@router.post("/ask")
async def ask_ai(
    request: AskRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client=Depends(get_user_weaviate_client),
    openai_key: str | None = Depends(get_openai_api_key),
):
    """Ask AI a question about your monitored functions."""
    if not await check_can_use_ai(db, user):
        raise HTTPException(
            status_code=429,
            detail="Daily AI usage limit reached. Upgrade to Pro for unlimited access.",
        )

    if not openai_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key required. Please set your API key in Settings.",
        )

    service = AskAiService(client=client, openai_api_key=openai_key)
    result = service.ask(question=request.question, function_name=request.function_name)

    if result.get("status") == "success":
        await increment_usage(db, user.id)

        # Auto-save to history
        try:
            import uuid as _uuid
            saved_id = str(_uuid.uuid4())
            saved = SavedResponse(
                id=saved_id,
                user_id=user.id,
                question=result.get("question", request.question),
                answer=result.get("answer", ""),
                source_type="ask_ai",
                function_name=result.get("function_name") or request.function_name,
                is_bookmarked=False,
            )
            db.add(saved)
            await db.commit()
            result["saved_id"] = saved_id
        except Exception as e:
            logger.warning(f"Failed to auto-save Ask AI response: {e}")

    return result
