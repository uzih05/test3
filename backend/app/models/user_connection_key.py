"""
User-Connection API Key Model
Stores per (User × Connection) API keys.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserConnectionKey(Base):
    __tablename__ = "user_connection_keys"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    connection_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("weaviate_connections.id", ondelete="CASCADE"), nullable=False
    )
    openai_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "connection_id", name="uq_user_connection"),
    )

    user = relationship("User", back_populates="connection_keys")
    connection = relationship("WeaviateConnection", back_populates="user_keys")
