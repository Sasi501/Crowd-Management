"""
Domain models for Crowd Management System
Core business entities and value objects
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LocationType(str, Enum):
    BUS_STOP = "bus_stop"
    STATION = "station"
    MARKET = "market"
    EVENT_VENUE = "event_venue"
    PUBLIC_SPACE = "public_space"


class Location(BaseModel):
    """Location entity representing a monitored area"""
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    type: LocationType
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    capacity: int = Field(..., gt=0)
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CrowdMeasurement(BaseModel):
    """Crowd measurement data point"""
    id: Optional[int] = None
    location_id: int
    person_count: int = Field(..., ge=0)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    crowd_density: Optional[float] = Field(default=0.0, ge=0.0)
    camera_id: Optional[str] = None
    image_path: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class User(BaseModel):
    """User account details"""
    id: Optional[int] = None
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)
    role: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None


class AlertThreshold(BaseModel):
    """Alert threshold configuration"""
    id: Optional[int] = None
    location_id: int
    threshold_value: int = Field(..., gt=0)
    severity: AlertSeverity
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Alert(BaseModel):
    """Alert instance when threshold is exceeded"""
    id: Optional[int] = None
    location_id: int
    threshold_id: int
    actual_value: int
    threshold_value: int
    severity: AlertSeverity
    message: str
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CrowdAnalytics(BaseModel):
    """Analytics data for crowd patterns"""
    location_id: int
    time_range: str  # e.g., "1h", "24h", "7d"
    average_crowd: float
    peak_crowd: int
    peak_time: datetime
    total_measurements: int
    trend_direction: str  # "increasing", "decreasing", "stable"


class CameraConfig(BaseModel):
    """Camera configuration for monitoring"""
    id: Optional[str] = None
    location_id: int
    camera_url: str
    name: str
    is_active: bool = True
    fps: int = Field(default=30, ge=1, le=60)
    resolution: str = "1920x1080"
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Request/Response models for API
class CreateLocationRequest(BaseModel):
    name: str
    type: LocationType
    latitude: float
    longitude: float
    capacity: int
    description: Optional[str] = None


class UpdateLocationRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[LocationType] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CrowdMeasurementResponse(BaseModel):
    id: int
    location_id: int
    location_name: str
    person_count: int
    confidence_score: float
    timestamp: datetime


class AlertResponse(BaseModel):
    id: int
    location_id: int
    location_name: str
    severity: AlertSeverity
    message: str
    actual_value: int
    threshold_value: int
    created_at: datetime
    is_resolved: bool


class DashboardStats(BaseModel):
    total_locations: int
    active_cameras: int
    current_alerts: int
    average_crowd_density: float
    total_measurements_today: int