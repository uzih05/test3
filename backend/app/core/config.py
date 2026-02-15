"""
VectorSurfer 2.0 Backend Configuration

Loads settings from environment variables or ..env file.
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",      # Next.js dev
        "http://127.0.0.1:3000",
        "http://localhost:8000",      # FastAPI dev
        "https://test3-six-rose.vercel.app",  # Vercel production
    ]
    
    # VectorWave (inherit from VectorWave's ..env)
    WEAVIATE_HOST: str = "localhost"
    WEAVIATE_PORT: int = 8080
    
    # Weaviate Collection Names (VectorWave schema)
    COLLECTION_NAME: str = "VectorWaveFunctions"
    EXECUTION_COLLECTION_NAME: str = "VectorWaveExecutions"
    GOLDEN_COLLECTION_NAME: str = "VectorWaveGoldenDataset"

    # [BYOD] PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://vectorsurfer:vectorsurfer_dev@localhost:5432/vectorsurfer"

    # [BYOD] JWT
    SECRET_KEY: str = "vectorsurfer-dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = "..env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
