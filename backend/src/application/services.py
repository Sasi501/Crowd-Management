"""
Application services for crowd management business logic
"""

from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime, timedelta
from sqlalchemy import func, desc

from src.domain.models import (
    Location, CrowdMeasurement, Alert, AlertThreshold,
    AlertSeverity, CrowdAnalytics, DashboardStats, User
)
from src.infrastructure.database import (
    LocationDB, CrowdMeasurementDB, AlertDB, AlertThresholdDB, UserDB
)
from src.infrastructure.crowd_detection import crowd_detection_service

logger = logging.getLogger(__name__)


class LocationService:
    """Service for managing locations"""

    @staticmethod
    def create_location(db: Session, location_data: dict) -> Location:
        """Create a new location"""
        db_location = LocationDB(**location_data)
        db.add(db_location)
        db.commit()
        db.refresh(db_location)
        return Location.from_orm(db_location)

    @staticmethod
    def get_location(db: Session, location_id: int) -> Optional[Location]:
        """Get location by ID"""
        db_location = db.query(LocationDB).filter(LocationDB.id == location_id).first()
        return Location.from_orm(db_location) if db_location else None

    @staticmethod
    def get_all_locations(db: Session, active_only: bool = True) -> List[Location]:
        """Get all locations"""
        query = db.query(LocationDB)
        if active_only:
            query = query.filter(LocationDB.is_active == True)
        db_locations = query.all()
        return [Location.from_orm(loc) for loc in db_locations]

    @staticmethod
    def update_location(db: Session, location_id: int, update_data: dict) -> Optional[Location]:
        """Update location"""
        db_location = db.query(LocationDB).filter(LocationDB.id == location_id).first()
        if not db_location:
            return None

        for key, value in update_data.items():
            if hasattr(db_location, key):
                setattr(db_location, key, value)

        db.commit()
        db.refresh(db_location)
        return Location.from_orm(db_location)


class UserService:
    """Service for managing users"""

    @staticmethod
    def create_user(db: Session, user_data: dict) -> User:
        db_user = UserDB(**user_data)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return User.from_orm(db_user)

    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        db_user = db.query(UserDB).filter(UserDB.id == user_id).first()
        return User.from_orm(db_user) if db_user else None

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        db_user = db.query(UserDB).filter(UserDB.username == username).first()
        return User.from_orm(db_user) if db_user else None

    @staticmethod
    def get_all_users(db: Session) -> List[User]:
        db_users = db.query(UserDB).all()
        return [User.from_orm(u) for u in db_users]

    @staticmethod
    def update_user(db: Session, user_id: int, update_data: dict) -> Optional[User]:
        db_user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not db_user:
            return None

        for key, value in update_data.items():
            if hasattr(db_user, key):
                setattr(db_user, key, value)

        db.commit()
        db.refresh(db_user)
        return User.from_orm(db_user)

    @staticmethod
    def delete_user(db: Session, user_id: int) -> bool:
        db_user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not db_user:
            return False
        db.delete(db_user)
        db.commit()
        return True


class CrowdMeasurementService:
    """Service for managing crowd measurements"""

    @staticmethod
    def create_measurement(db: Session, measurement_data: dict) -> CrowdMeasurement:
        """Create a new crowd measurement"""
        db_measurement = CrowdMeasurementDB(**measurement_data)
        db.add(db_measurement)
        db.commit()
        db.refresh(db_measurement)
        return CrowdMeasurement.from_orm(db_measurement)

    @staticmethod
    def get_recent_measurements(db: Session, location_id: int, hours: int = 24) -> List[CrowdMeasurement]:
        """Get recent measurements for a location"""
        since_time = datetime.utcnow() - timedelta(hours=hours)
        db_measurements = (
            db.query(CrowdMeasurementDB)
            .filter(
                CrowdMeasurementDB.location_id == location_id,
                CrowdMeasurementDB.timestamp >= since_time
            )
            .order_by(desc(CrowdMeasurementDB.timestamp))
            .all()
        )
        return [CrowdMeasurement.from_orm(m) for m in db_measurements]

    @staticmethod
    async def process_camera_feed(db: Session, camera_id: str, camera_url: str) -> Dict[str, Any]:
        """Process camera feed and store measurements"""
        try:
            # Get camera configuration
            camera_config = db.query(LocationDB).join(LocationDB.cameras).filter(
                LocationDB.cameras.any(id=camera_id)
            ).first()

            if not camera_config:
                raise ValueError(f"Camera {camera_id} not found")

            # Process video stream
            results = await crowd_detection_service.process_video_stream(camera_url, camera_id)

            # Store measurements
            measurements = []
            for detection in results.get('detections', []):
                measurement_data = {
                    'location_id': camera_config.id,
                    'person_count': results.get('total_persons_detected', 0),
                    'confidence_score': detection.get('confidence', 0.0),
                    'camera_id': camera_id,
                    'timestamp': datetime.utcnow()
                }
                measurement = CrowdMeasurementService.create_measurement(db, measurement_data)
                measurements.append(measurement)

            return {
                'success': True,
                'camera_id': camera_id,
                'measurements_stored': len(measurements),
                'total_persons': results.get('total_persons_detected', 0),
                'processing_time': results.get('processing_time', 0.0)
            }

        except Exception as e:
            logger.error(f"Error processing camera feed {camera_id}: {e}")
            return {
                'success': False,
                'camera_id': camera_id,
                'error': str(e)
            }


class AlertService:
    """Service for managing alerts"""

    @staticmethod
    def create_alert_threshold(db: Session, threshold_data: dict) -> AlertThreshold:
        """Create alert threshold"""
        db_threshold = AlertThresholdDB(**threshold_data)
        db.add(db_threshold)
        db.commit()
        db.refresh(db_threshold)
        return AlertThreshold.from_orm(db_threshold)

    @staticmethod
    def check_alerts(db: Session, location_id: int, current_count: int) -> List[Alert]:
        """Check if current count triggers any alerts"""
        # Get active thresholds for location
        thresholds = (
            db.query(AlertThresholdDB)
            .filter(
                AlertThresholdDB.location_id == location_id,
                AlertThresholdDB.is_active == True
            )
            .all()
        )

        alerts_created = []
        for threshold in thresholds:
            if current_count >= threshold.threshold_value:
                # Check if alert already exists and is unresolved
                existing_alert = (
                    db.query(AlertDB)
                    .filter(
                        AlertDB.location_id == location_id,
                        AlertDB.threshold_id == threshold.id,
                        AlertDB.is_resolved == False
                    )
                    .first()
                )

                if not existing_alert:
                    alert_data = {
                        'location_id': location_id,
                        'threshold_id': threshold.id,
                        'actual_value': current_count,
                        'threshold_value': threshold.threshold_value,
                        'severity': threshold.severity,
                        'message': f"Crowd threshold exceeded: {current_count} people (limit: {threshold.threshold_value})"
                    }
                    alert = AlertService.create_alert(db, alert_data)
                    alerts_created.append(alert)

        return alerts_created

    @staticmethod
    def create_alert(db: Session, alert_data: dict) -> Alert:
        """Create a new alert"""
        db_alert = AlertDB(**alert_data)
        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)
        return Alert.from_orm(db_alert)

    @staticmethod
    def get_active_alerts(db: Session) -> List[Alert]:
        """Get all active (unresolved) alerts"""
        db_alerts = (
            db.query(AlertDB)
            .filter(AlertDB.is_resolved == False)
            .order_by(desc(AlertDB.created_at))
            .all()
        )
        return [Alert.from_orm(alert) for alert in db_alerts]

    @staticmethod
    def resolve_alert(db: Session, alert_id: int) -> bool:
        """Resolve an alert"""
        db_alert = db.query(AlertDB).filter(AlertDB.id == alert_id).first()
        if db_alert:
            db_alert.is_resolved = True
            db_alert.resolved_at = datetime.utcnow()
            db.commit()
            return True
        return False


class AnalyticsService:
    """Service for crowd analytics"""

    @staticmethod
    def get_crowd_analytics(db: Session, location_id: int, hours: int = 24) -> CrowdAnalytics:
        """Get crowd analytics for a location"""
        since_time = datetime.utcnow() - timedelta(hours=hours)

        # Get measurements
        measurements = (
            db.query(CrowdMeasurementDB)
            .filter(
                CrowdMeasurementDB.location_id == location_id,
                CrowdMeasurementDB.timestamp >= since_time
            )
            .all()
        )

        if not measurements:
            return CrowdAnalytics(
                location_id=location_id,
                time_range=f"{hours}h",
                average_crowd=0.0,
                peak_crowd=0,
                peak_time=datetime.utcnow(),
                total_measurements=0,
                trend_direction="stable"
            )

        person_counts = [m.person_count for m in measurements]
        average_crowd = sum(person_counts) / len(person_counts)
        peak_crowd = max(person_counts)
        peak_measurement = max(measurements, key=lambda m: m.person_count)

        # Simple trend analysis
        first_half = person_counts[:len(person_counts)//2]
        second_half = person_counts[len(person_counts)//2:]

        first_avg = sum(first_half) / len(first_half) if first_half else 0
        second_avg = sum(second_half) / len(second_half) if second_half else 0

        if second_avg > first_avg * 1.1:
            trend = "increasing"
        elif second_avg < first_avg * 0.9:
            trend = "decreasing"
        else:
            trend = "stable"

        return CrowdAnalytics(
            location_id=location_id,
            time_range=f"{hours}h",
            average_crowd=round(average_crowd, 2),
            peak_crowd=peak_crowd,
            peak_time=peak_measurement.timestamp,
            total_measurements=len(measurements),
            trend_direction=trend
        )

    @staticmethod
    def get_dashboard_stats(db: Session) -> DashboardStats:
        """Get dashboard statistics"""
        # Total locations
        total_locations = db.query(func.count(LocationDB.id)).scalar()

        # Active cameras (simplified - count locations with active status)
        active_cameras = db.query(func.count(LocationDB.id)).filter(
            LocationDB.is_active == True
        ).scalar()

        # Current alerts
        current_alerts = db.query(func.count(AlertDB.id)).filter(
            AlertDB.is_resolved == False
        ).scalar()

        # Average crowd density (last measurement per location)
        recent_measurements = (
            db.query(CrowdMeasurementDB)
            .filter(CrowdMeasurementDB.timestamp >= datetime.utcnow() - timedelta(hours=1))
            .all()
        )

        avg_density = 0.0
        if recent_measurements:
            total_people = sum(m.person_count for m in recent_measurements)
            avg_density = total_people / len(recent_measurements)

        # Total measurements today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        total_measurements_today = (
            db.query(func.count(CrowdMeasurementDB.id))
            .filter(CrowdMeasurementDB.timestamp >= today_start)
            .scalar()
        )

        return DashboardStats(
            total_locations=total_locations or 0,
            active_cameras=active_cameras or 0,
            current_alerts=current_alerts or 0,
            average_crowd_density=round(avg_density, 2),
            total_measurements_today=total_measurements_today or 0
        )