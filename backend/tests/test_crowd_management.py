"""
Tests for Crowd Management System
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.infrastructure.database import Base, get_db
from src.domain.models import Location, CrowdMeasurement
from src.application.services import LocationService, CrowdMeasurementService


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def test_db():
    """Create test database"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.mark.asyncio
async def test_create_location(test_db):
    """Test location creation"""
    location_data = {
        "name": "Test Bus Stop",
        "type": "bus_stop",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "capacity": 50,
        "description": "Test location"
    }

    location = LocationService.create_location(test_db, location_data)

    assert location.name == "Test Bus Stop"
    assert location.type == "bus_stop"
    assert location.capacity == 50
    assert location.is_active == True


@pytest.mark.asyncio
async def test_get_location(test_db):
    """Test location retrieval"""
    # Create location first
    location_data = {
        "name": "Test Station",
        "type": "station",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "capacity": 100
    }

    created_location = LocationService.create_location(test_db, location_data)

    # Retrieve location
    retrieved_location = LocationService.get_location(test_db, created_location.id)

    assert retrieved_location is not None
    assert retrieved_location.id == created_location.id
    assert retrieved_location.name == "Test Station"


@pytest.mark.asyncio
async def test_create_crowd_measurement(test_db):
    """Test crowd measurement creation"""
    # Create location first
    location_data = {
        "name": "Test Location",
        "type": "public_space",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "capacity": 200
    }

    location = LocationService.create_location(test_db, location_data)

    # Create measurement
    measurement_data = {
        "location_id": location.id,
        "person_count": 25,
        "confidence_score": 0.85,
        "camera_id": "cam_001"
    }

    measurement = CrowdMeasurementService.create_measurement(test_db, measurement_data)

    assert measurement.location_id == location.id
    assert measurement.person_count == 25
    assert measurement.confidence_score == 0.85
    assert measurement.camera_id == "cam_001"


@pytest.mark.asyncio
async def test_create_user(test_db):
    """Test user creation and retrieval"""
    user_data = {
        "username": "testuser",
        "password": "pass1234",
        "role": "admin",
        "email": "testuser@example.com",
        "full_name": "Test User"
    }

    from src.application.services import UserService

    user = UserService.create_user(test_db, user_data)

    assert user is not None
    assert user.username == "testuser"
    assert user.role == "admin"
    assert user.email == "testuser@example.com"

    retrieved = UserService.get_user(test_db, user.id)
    assert retrieved is not None
    assert retrieved.username == "testuser"


@pytest.mark.asyncio
async def test_get_recent_measurements(test_db):
    """Test retrieving recent measurements"""
    # Create location
    location_data = {
        "name": "Test Location",
        "type": "market",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "capacity": 150
    }

    location = LocationService.create_location(test_db, location_data)

    # Create multiple measurements
    measurements_data = [
        {"location_id": location.id, "person_count": 10, "confidence_score": 0.8},
        {"location_id": location.id, "person_count": 20, "confidence_score": 0.9},
        {"location_id": location.id, "person_count": 15, "confidence_score": 0.85}
    ]

    for data in measurements_data:
        CrowdMeasurementService.create_measurement(test_db, data)

    # Retrieve recent measurements
    recent = CrowdMeasurementService.get_recent_measurements(test_db, location.id, hours=24)

    assert len(recent) == 3
    # Should be ordered by timestamp descending
    assert recent[0].person_count == 15  # Most recent


if __name__ == "__main__":
    pytest.main([__file__, "-v"])