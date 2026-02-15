"""
Weaviate Connection Model
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class WeaviateConnection(Base):
    __tablename__ = "weaviate_connections"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Default")
    connection_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="self_hosted"
    )  # "self_hosted" or "wcs_cloud"
    host: Mapped[str] = mapped_column(String(255), nullable=False, default="localhost")
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=8080)
    grpc_port: Mapped[int] = mapped_column(Integer, nullable=False, default=50051)
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vectorizer_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None
    )  # "huggingface" or "openai"
    vectorizer_model: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="connections")
    user_keys = relationship("UserConnectionKey", back_populates="connection", cascade="all, delete-orphan")
