"""
User Model
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=True)
    openai_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    connections = relationship("WeaviateConnection", back_populates="user", cascade="all, delete-orphan")
    connection_keys = relationship("UserConnectionKey", back_populates="user", cascade="all, delete-orphan")
    widgets = relationship("DashboardWidget", back_populates="user", cascade="all, delete-orphan")
    github_token = relationship("UserGitHubToken", back_populates="user", uselist=False, cascade="all, delete-orphan")
