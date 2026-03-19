# """
# FastAPI routes for Crowd Management System
# """

# from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
# from sqlalchemy.orm import Session
# from typing import List, Optional
# from datetime import datetime
# import cv2
# import numpy as np
# from io import BytesIO
# from PIL import Image
# import logging

# logger = logging.getLogger(__name__)

# from src.domain.models import (
#     Location, CrowdMeasurement, Alert, AlertThreshold,
#     User, CreateLocationRequest, UpdateLocationRequest,
#     CrowdMeasurementResponse, AlertResponse, DashboardStats, CrowdAnalytics
# )
# from src.infrastructure.database import get_db
# from src.infrastructure.crowd_detection import CrowdDetectionService
# from src.application.services import (
#     LocationService, CrowdMeasurementService, AlertService, AnalyticsService, UserService
# )

# router = APIRouter()


# # Location routes
# @router.post("/locations", response_model=Location)
# async def create_location(
#     location: CreateLocationRequest,
#     db: Session = Depends(get_db)
# ):
#     """Create a new location"""
#     try:
#         location_data = location.dict()
#         return LocationService.create_location(db, location_data)
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))


# @router.get("/locations", response_model=List[Location])
# async def get_locations(
#     active_only: bool = True,
#     db: Session = Depends(get_db)
# ):
#     """Get all locations"""
#     return LocationService.get_all_locations(db, active_only)


# @router.get("/locations/{location_id}", response_model=Location)
# async def get_location(
#     location_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Get location by ID"""
#     location = LocationService.get_location(db, location_id)
#     if not location:
#         raise HTTPException(status_code=404, detail="Location not found")
#     return location


# # User routes
# @router.post("/users", response_model=User)
# async def create_user(
#     user: User,
#     db: Session = Depends(get_db)
# ):
#     existing = UserService.get_user_by_username(db, user.username)
#     if existing:
#         raise HTTPException(status_code=400, detail="Username already exists")
#     user_data = user.dict(exclude_unset=True)
#     return UserService.create_user(db, user_data)


# @router.get("/users", response_model=List[User])
# async def get_all_users(db: Session = Depends(get_db)):
#     return UserService.get_all_users(db)


# @router.get("/users/{user_id}", response_model=User)
# async def get_user(user_id: int, db: Session = Depends(get_db)):
#     user_obj = UserService.get_user(db, user_id)
#     if not user_obj:
#         raise HTTPException(status_code=404, detail="User not found")
#     return user_obj


# @router.put("/users/{user_id}", response_model=User)
# async def update_user(user_id: int, user: User, db: Session = Depends(get_db)):
#     updated = UserService.update_user(db, user_id, user.dict(exclude_unset=True))
#     if not updated:
#         raise HTTPException(status_code=404, detail="User not found")
#     return updated


# @router.delete("/users/{user_id}")
# async def delete_user(user_id: int, db: Session = Depends(get_db)):
#     success = UserService.delete_user(db, user_id)
#     if not success:
#         raise HTTPException(status_code=404, detail="User not found")
#     return {"message": "User deleted"}


# @router.put("/locations/{location_id}", response_model=Location)
# async def update_location(
#     location_id: int,
#     location_update: UpdateLocationRequest,
#     db: Session = Depends(get_db)
# ):
#     """Update location"""
#     update_data = location_update.dict(exclude_unset=True)
#     location = LocationService.update_location(db, location_id, update_data)
#     if not location:
#         raise HTTPException(status_code=404, detail="Location not found")
#     return location


# # Crowd measurement routes
# @router.get("/measurements/{location_id}", response_model=List[CrowdMeasurementResponse])
# async def get_recent_measurements(
#     location_id: int,
#     hours: int = 24,
#     db: Session = Depends(get_db)
# ):
#     """Get recent crowd measurements for a location"""
#     measurements = CrowdMeasurementService.get_recent_measurements(db, location_id, hours)

#     # Enrich with location names
#     location = LocationService.get_location(db, location_id)
#     location_name = location.name if location else "Unknown"

#     return [
#         CrowdMeasurementResponse(
#             id=m.id,
#             location_id=m.location_id,
#             location_name=location_name,
#             person_count=m.person_count,
#             confidence_score=m.confidence_score,
#             timestamp=m.timestamp
#         )
#         for m in measurements
#     ]


# @router.post("/measurements/process-camera/{camera_id}")
# async def process_camera_feed(
#     camera_id: str,
#     background_tasks: BackgroundTasks,
#     db: Session = Depends(get_db)
# ):
#     """Process camera feed and store measurements"""
#     # This would typically get camera URL from database
#     # For now, we'll use a placeholder
#     camera_url = f"rtsp://camera-{camera_id}:554/stream"

#     background_tasks.add_task(
#         CrowdMeasurementService.process_camera_feed,
#         db, camera_id, camera_url
#     )

#     return {"message": f"Camera processing started for {camera_id}"}


# # Alert routes
# @router.post("/alerts/thresholds", response_model=AlertThreshold)
# async def create_alert_threshold(
#     threshold: dict,
#     db: Session = Depends(get_db)
# ):
#     """Create alert threshold"""
#     return AlertService.create_alert_threshold(db, threshold)


# @router.get("/alerts", response_model=List[AlertResponse])
# async def get_active_alerts(db: Session = Depends(get_db)):
#     """Get all active alerts"""
#     alerts = AlertService.get_active_alerts(db)

#     # Enrich with location names
#     enriched_alerts = []
#     for alert in alerts:
#         location = LocationService.get_location(db, alert.location_id)
#         location_name = location.name if location else "Unknown"

#         enriched_alerts.append(AlertResponse(
#             id=alert.id,
#             location_id=alert.location_id,
#             location_name=location_name,
#             severity=alert.severity,
#             message=alert.message,
#             actual_value=alert.actual_value,
#             threshold_value=alert.threshold_value,
#             created_at=alert.created_at,
#             is_resolved=alert.is_resolved
#         ))

#     return enriched_alerts


# @router.put("/alerts/{alert_id}/resolve")
# async def resolve_alert(
#     alert_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Resolve an alert"""
#     success = AlertService.resolve_alert(db, alert_id)
#     if not success:
#         raise HTTPException(status_code=404, detail="Alert not found")
#     return {"message": "Alert resolved successfully"}


# # Analytics routes
# @router.get("/analytics/{location_id}", response_model=CrowdAnalytics)
# async def get_crowd_analytics(
#     location_id: int,
#     hours: int = 24,
#     db: Session = Depends(get_db)
# ):
#     """Get crowd analytics for a location"""
#     return AnalyticsService.get_crowd_analytics(db, location_id, hours)


# @router.get("/dashboard/stats", response_model=DashboardStats)
# async def get_dashboard_stats(db: Session = Depends(get_db)):
#     """Get dashboard statistics"""
#     return AnalyticsService.get_dashboard_stats(db)


# # Crowd Detection endpoints
# @router.post("/crowd/detect")
# async def detect_crowd_from_image(
#     image: UploadFile = File(...),
#     location_id: Optional[int] = None,
#     db: Session = Depends(get_db)
# ):
#     """
#     Detect crowds in an uploaded image
#     Returns person count, confidence score, and crowd density
#     Optimized for real-time performance
#     """
#     try:
#         # Read image file
#         contents = await image.read()
#         nparr = np.frombuffer(contents, np.uint8)
#         frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
#         if frame is None:
#             raise HTTPException(status_code=400, detail="Invalid image file")
        
#         # Resize frame for faster processing (optional optimization)
#         # Uncomment to process smaller frames for faster inference
#         # frame = cv2.resize(frame, (416, 416))
        
#         # Initialize detection service
#         detection_service = CrowdDetectionService()
#         person_count, confidence_score, detections = await detection_service.detect_crowd(frame)
        
#         # Calculate crowd density
#         frame_area = frame.shape[0] * frame.shape[1]
#         crowd_density = person_count / (frame_area / 10000) if frame_area > 0 else 0
        
#         # Store measurement if location_id provided (non-blocking)
#         if location_id:
#             try:
#                 measurement_data = {
#                     "location_id": location_id,
#                     "person_count": person_count,
#                     "confidence_score": confidence_score,
#                     "crowd_density": float(crowd_density),
#                     "camera_id": None,
#                     "timestamp": datetime.utcnow()
#                 }
#                 CrowdMeasurementService.create_measurement(db, measurement_data)
#             except Exception as e:
#                 logger.warning(f"Error storing measurement: {e}")
        
#         # Check for alerts (non-blocking)
#         alert = None
#         if location_id:
#             try:
#                 location = LocationService.get_location(db, location_id)
#                 if location and person_count > location.capacity * 0.8:  # 80% capacity
#                     alert_data = {
#                         "location_id": location_id,
#                         "severity": "high" if person_count > location.capacity else "medium",
#                         "message": f"High crowd density detected: {person_count} people",
#                         "actual_value": person_count,
#                         "threshold_value": location.capacity
#                     }
#                     alert = AlertService.create_alert(db, alert_data)
#             except Exception as e:
#                 logger.warning(f"Error creating alert: {e}")
        
#         return {
#             "person_count": person_count,
#             "confidence_score": float(confidence_score),
#             "crowd_density": float(crowd_density),
#             "detections": detections[:10],  # Limit returned detections for speed
#             "source_width": frame.shape[1],
#             "source_height": frame.shape[0],
#             "alert": alert is not None,
#             "alert_message": alert.message if alert else None,
#             "timestamp": datetime.utcnow().isoformat()
#         }
    
#     except Exception as e:
#         logger.error(f"Error detecting crowd: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error detecting crowd: {str(e)}")


# @router.post("/crowd/stream")
# async def start_rtsp_stream(
#     request: dict,
#     db: Session = Depends(get_db)
# ):
#     """
#     Start processing RTSP/HTTP stream from camera
#     """
#     try:
#         rtsp_url = request.get("rtsp_url")
        
#         if not rtsp_url:
#             raise HTTPException(status_code=400, detail="RTSP URL is required")
        
#         # Validate URL
#         if not (rtsp_url.startswith("rtsp://") or rtsp_url.startswith("http")):
#             raise HTTPException(status_code=400, detail="Invalid RTSP/HTTP URL")
        
#         return {
#             "message": "Stream processing started",
#             "stream_url": rtsp_url,
#             "status": "active"
#         }
    
#     except Exception as e:
#         logger.error(f"Error starting stream: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @router.post("/crowd/stream/stop")
# async def stop_stream():
#     """Stop stream processing"""
#     return {"message": "Stream processing stopped", "status": "inactive"}
# @router.get("/health")
# async def health_check():
#     """Health check endpoint with GPU status"""
#     try:
#         import torch
#         gpu_available = torch.cuda.is_available()
#         gpu_name = torch.cuda.get_device_name(0) if gpu_available else "N/A"
#     except:
#         gpu_available = False
#         gpu_name = "N/A"
    
#     return {
#         "status": "healthy",
#         "timestamp": datetime.utcnow().isoformat(),
#         "service": "crowd-management-api",
#         "gpu_available": gpu_available,
#         "gpu_device": gpu_name
#     }

"""
Crowd detection + database API routes
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import numpy as np
import cv2
import logging

from src.infrastructure.crowd_detection import crowd_detection_service
from src.infrastructure.database import get_db, CrowdLogDB, AlertLogDB, UserDB

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic request schemas ───────────────────────────────────────────────
class CrowdLogRequest(BaseModel):
    mode: str          # 'line_crossing' | 'dual_camera'
    source: str        # 'in' | 'out' | 'line'
    crowd_count: int
    delta: int         # +1 or -1
    confidence: Optional[float] = None
    person_id: Optional[int] = None

class AlertRequest(BaseModel):
    crowd_count: int
    max_capacity: int
    severity: str      # 'warning' | 'critical'
    message: str

class ResolveAlertRequest(BaseModel):
    alert_id: int

class UserRequest(BaseModel):
    username: str
    password: str
    role: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True


# ── Detection ──────────────────────────────────────────────────────────────
@router.post("/crowd/detect")
async def detect_crowd(image: UploadFile = File(...)):
    try:
        contents = await image.read()
        np_arr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        person_count, avg_confidence, detections = await crowd_detection_service.detect_crowd(frame)
        return {
            "person_count": person_count,
            "confidence_score": avg_confidence,
            "crowd_density": person_count / 50 if person_count > 0 else 0,
            "detections": detections,
            "source_width": frame.shape[1],
            "source_height": frame.shape[0]
        }
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/crowd/health")
async def health_check():
    return {"status": "ok", "model_loaded": crowd_detection_service.model is not None}


# ── Crowd logs ─────────────────────────────────────────────────────────────
@router.post("/crowd/log")
def log_crowd(req: CrowdLogRequest, db: Session = Depends(get_db)):
    """Save a crowd count change to DB"""
    entry = CrowdLogDB(
        mode=req.mode,
        source=req.source,
        crowd_count=req.crowd_count,
        delta=req.delta,
        confidence=req.confidence,
        person_id=req.person_id
    )
    db.add(entry)
    db.commit()
    return {"saved": True, "id": entry.id}


@router.get("/crowd/chart")
def get_chart_data(hours: int = 24, db: Session = Depends(get_db)):
    """
    Returns crowd_count grouped by hour for the last N hours.
    Separate series for line_crossing and dual_camera.
    """
    since = datetime.utcnow() - timedelta(hours=hours)
    rows = (
        db.query(
            func.date_format(CrowdLogDB.timestamp, "%Y-%m-%d %H:00").label("hour"),
            CrowdLogDB.mode,
            func.avg(CrowdLogDB.crowd_count).label("avg_count")
        )
        .filter(CrowdLogDB.timestamp >= since)
        .group_by("hour", CrowdLogDB.mode)
        .order_by("hour")
        .all()
    )

    # Build unified time-series [{time, line_crossing, dual_camera}]
    data = {}
    for row in rows:
        t = row.hour
        if t not in data:
            data[t] = {"time": t, "line_crossing": 0, "dual_camera": 0}
        data[t][row.mode] = round(row.avg_count, 1)

    return list(data.values())


@router.get("/crowd/logs")
def get_recent_logs(hours: int = 24, mode: Optional[str] = None, db: Session = Depends(get_db)):
    """Raw logs for table view"""
    since = datetime.utcnow() - timedelta(hours=hours)
    q = db.query(CrowdLogDB).filter(CrowdLogDB.timestamp >= since)
    if mode:
        q = q.filter(CrowdLogDB.mode == mode)
    rows = q.order_by(desc(CrowdLogDB.timestamp)).limit(200).all()
    return [
        {
            "id": r.id, "mode": r.mode, "source": r.source,
            "crowd_count": r.crowd_count, "delta": r.delta,
            "confidence": r.confidence, "person_id": r.person_id,
            "timestamp": r.timestamp.isoformat()
        } for r in rows
    ]


# ── Alerts ─────────────────────────────────────────────────────────────────
@router.post("/alerts/log")
def log_alert(req: AlertRequest, db: Session = Depends(get_db)):
    """Save a triggered alert to DB"""
    entry = AlertLogDB(
        crowd_count=req.crowd_count,
        max_capacity=req.max_capacity,
        severity=req.severity,
        message=req.message
    )
    db.add(entry)
    db.commit()
    return {"saved": True, "id": entry.id}


@router.get("/alerts")
def get_alerts(resolved: bool = False, db: Session = Depends(get_db)):
    """Get alerts — unresolved by default"""
    rows = (
        db.query(AlertLogDB)
        .filter(AlertLogDB.is_resolved == resolved)
        .order_by(desc(AlertLogDB.triggered_at))
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id, "crowd_count": r.crowd_count, "max_capacity": r.max_capacity,
            "severity": r.severity, "message": r.message,
            "is_resolved": r.is_resolved,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "triggered_at": r.triggered_at.isoformat()
        } for r in rows
    ]


@router.put("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    row = db.query(AlertLogDB).filter(AlertLogDB.id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    row.is_resolved = True
    row.resolved_at = datetime.utcnow()
    db.commit()
    return {"resolved": True}


# ── Users ──────────────────────────────────────────────────────────────────
@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    rows = db.query(UserDB).all()
    return [
        {
            "id": u.id, "username": u.username, "role": u.role,
            "email": u.email, "full_name": u.full_name, "department": u.department,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None
        } for u in rows
    ]


@router.post("/users")
def create_user(req: UserRequest, db: Session = Depends(get_db)):
    if db.query(UserDB).filter(UserDB.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = UserDB(**req.dict())
    db.add(user)
    db.commit()
    return {"saved": True, "id": user.id}


@router.put("/users/{user_id}")
def update_user(user_id: int, req: UserRequest, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for k, v in req.dict().items():
        setattr(user, k, v)
    db.commit()
    return {"updated": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": True}


@router.post("/users/login")
def login_user(req: dict, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(
        UserDB.username == req.get("username"),
        UserDB.password == req.get("password"),
        UserDB.is_active == True
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.last_login = datetime.utcnow()
    db.commit()
    return {
        "id": user.id, "username": user.username, "role": user.role,
        "full_name": user.full_name, "department": user.department
    }