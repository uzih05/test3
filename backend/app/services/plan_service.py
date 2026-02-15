"""
Plan Service

Handles Free/Pro plan logic and daily AI usage tracking.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_usage import AiUsage
from app.models.user import User

FREE_DAILY_LIMIT = 5


async def get_usage_today(db: AsyncSession, user_id: str) -> int:
    """Get today's AI call count for a user."""
    today = date.today()
    result = await db.execute(
        select(AiUsage).where(AiUsage.user_id == user_id, AiUsage.usage_date == today)
    )
    usage = result.scalar_one_or_none()
    return usage.call_count if usage else 0


async def increment_usage(db: AsyncSession, user_id: str) -> int:
    """Increment today's usage count. Returns new count."""
    today = date.today()
    result = await db.execute(
        select(AiUsage).where(AiUsage.user_id == user_id, AiUsage.usage_date == today)
    )
    usage = result.scalar_one_or_none()
    if usage:
        usage.call_count += 1
        await db.commit()
        return usage.call_count
    else:
        new_usage = AiUsage(user_id=user_id, usage_date=today, call_count=1)
        db.add(new_usage)
        await db.commit()
        return 1


async def check_can_use_ai(db: AsyncSession, user: User) -> bool:
    """Check if user can make an AI call based on their plan."""
    if user.plan == "pro":
        return True
    count = await get_usage_today(db, user.id)
    return count < FREE_DAILY_LIMIT


async def get_plan_info(db: AsyncSession, user: User) -> dict:
    """Return plan info for the frontend."""
    count = await get_usage_today(db, user.id)
    return {
        "plan": user.plan,
        "daily_limit": FREE_DAILY_LIMIT if user.plan == "free" else None,
        "usage_today": count,
        "can_use_ai": user.plan == "pro" or count < FREE_DAILY_LIMIT,
    }
