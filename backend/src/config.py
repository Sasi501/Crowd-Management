"""
Application configuration
"""

from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB connection — default points to local instance
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db:  str = "crowd_management"

    yolo_model_path: str = "yolov8n.pt"
    confidence_threshold: float = 0.5
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    smtp_email: str = ""
    smtp_password: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
