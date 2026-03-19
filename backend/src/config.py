"""
Application configuration
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Database
    database_url: str = "mysql+pymysql://root:password@localhost:3306/crowd_management"

    # Redis (optional)
    redis_url: Optional[str] = "redis://localhost:6379"

    # Computer Vision
    yolo_model_path: str = "yolov8n.pt"
    confidence_threshold: float = 0.5
    max_detection_frames: int = 100

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug_mode: bool = True

    # Security
    secret_key: str = "your-secret-key-change-in-production"
    access_token_expire_minutes: int = 30

    # File storage
    upload_directory: str = "uploads"
    max_upload_size: int = 10 * 1024 * 1024  # 10MB

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
