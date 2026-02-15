"""
Dashboard Widget Model
Stores per-user dashboard widget configuration.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    widget_type: Mapped[str] = mapped_column(String(50), nullable=False)
    position_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    size: Mapped[str] = mapped_column(String(1), nullable=False, default="M")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="widgets")
