"""
Saved Response Model

Stores all AI Q&A pairs from Ask AI, Healer, etc.
Auto-saved on every AI response. Bookmark for favorites.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SavedResponse(Base):
    __tablename__ = "saved_responses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    function_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="saved_responses")
