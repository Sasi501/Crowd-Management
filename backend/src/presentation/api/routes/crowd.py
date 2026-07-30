"""
FastAPI routes — Crowd Management System
Database: MongoDB via Motor (async)
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import numpy as np
import cv2
import logging
from bson import ObjectId

from src.infrastructure.crowd_detection import crowd_detection_service
from src.infrastructure.database import (
    get_users_col, get_crowd_logs_col, get_alert_logs_col
)

# ── Password hashing ───────────────────────────────────────────────────────
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception as e:
        logger.error(f"Hashing error: {e}")
        return password

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return plain == hashed  # fallback for legacy plaintext

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────
def utcnow() -> datetime:
    """Return a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

def _user_out(doc: dict) -> dict:
    """Serialize a user document for API responses (no password)."""
    return {
        "id":         str(doc["_id"]),
        "username":   doc.get("username"),
        "role":       doc.get("role"),
        "email":      doc.get("email"),
        "full_name":  doc.get("full_name"),
        "department": doc.get("department"),
        "is_active":  doc.get("is_active", True),
        "created_at": doc.get("created_at", utcnow()).isoformat(),
        "last_login": doc["last_login"].isoformat() if doc.get("last_login") else None,
    }


# ── Email helper ───────────────────────────────────────────────────────────
def send_email(to: str, subject: str, body: str) -> bool:
    import smtplib
    from email.mime.text import MIMEText
    from src.config import settings
    if not settings.smtp_email or not settings.smtp_password:
        logger.warning("SMTP not configured — email not sent")
        return False
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"]    = settings.smtp_email
        msg["To"]      = to
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(settings.smtp_email, settings.smtp_password)
            s.sendmail(settings.smtp_email, [to], msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return False


# ── Pydantic schemas ───────────────────────────────────────────────────────
class CrowdLogRequest(BaseModel):
    mode: str
    source: str
    crowd_count: int
    delta: int
    confidence: Optional[float] = None
    person_id: Optional[int] = None

class AlertRequest(BaseModel):
    crowd_count: int
    max_capacity: int
    severity: str
    message: str

class UserRequest(BaseModel):
    username: str
    password: str
    role: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True

class ForgotPasswordRequest(BaseModel):
    username: str
    role: str
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ActivationRequest(BaseModel):
    username: str
    email: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ══════════════════════════════════════════════════════════════════════════
#  DETECTION
# ══════════════════════════════════════════════════════════════════════════
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
            "person_count":     person_count,
            "confidence_score": avg_confidence,
            "crowd_density":    person_count / 50 if person_count > 0 else 0,
            "detections":       detections,
            "source_width":     frame.shape[1],
            "source_height":    frame.shape[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/crowd/health")
async def health_check():
    return {"status": "ok", "model_loaded": crowd_detection_service.model is not None}


# ══════════════════════════════════════════════════════════════════════════
#  CROWD LOGS
# ══════════════════════════════════════════════════════════════════════════
@router.post("/crowd/log")
async def log_crowd(req: CrowdLogRequest):
    col = get_crowd_logs_col()
    doc = {
        "mode":        req.mode,
        "source":      req.source,
        "crowd_count": req.crowd_count,
        "delta":       req.delta,
        "confidence":  req.confidence,
        "person_id":   req.person_id,
        "timestamp":   utcnow(),
    }
    result = await col.insert_one(doc)
    return {"saved": True, "id": str(result.inserted_id)}


@router.get("/crowd/chart")
async def get_chart_data(hours: int = 24):
    """
    Returns per-hour aggregation: in_count, out_count, crowd_count.
    Uses MongoDB aggregation pipeline.
    """
    col = get_crowd_logs_col()
    since = utcnow() - timedelta(hours=hours)

    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d %H:00",
                        "date": "$timestamp"
                    }
                },
                "in_count":    {"$sum": {"$cond": [{"$gt": ["$delta", 0]}, 1, 0]}},
                "out_count":   {"$sum": {"$cond": [{"$lt": ["$delta", 0]}, 1, 0]}},
                "crowd_count": {"$last": "$crowd_count"},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    results = await col.aggregate(pipeline).to_list(length=None)
    return [
        {
            "time":        r["_id"],
            "in_count":    r["in_count"],
            "out_count":   r["out_count"],
            "crowd_count": r["crowd_count"],
        }
        for r in results
    ]


@router.get("/crowd/logs")
async def get_recent_logs(
    hours: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    mode: Optional[str] = None,
):
    col = get_crowd_logs_col()
    query: dict = {}

    if from_date and to_date:
        try:
            start = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
            end   = (datetime.fromisoformat(to_date) + timedelta(days=1)).replace(tzinfo=timezone.utc)
            query["timestamp"] = {"$gte": start, "$lt": end}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        h = hours if hours else 24
        query["timestamp"] = {"$gte": utcnow() - timedelta(hours=h)}

    if mode:
        query["mode"] = mode

    cursor = col.find(query).sort("timestamp", -1).limit(500)
    rows = await cursor.to_list(length=500)
    return [
        {
            "id":          str(r["_id"]),
            "timestamp":   r["timestamp"].isoformat() if r.get("timestamp") else None,
            "mode":        r.get("mode"),
            "source":      r.get("source"),
            "crowd_count": r.get("crowd_count"),
            "delta":       r.get("delta"),
            "confidence":  r.get("confidence"),
            "person_id":   r.get("person_id"),
        }
        for r in rows
    ]


@router.get("/crowd/forecast")
async def get_forecast():
    """
    Predicts peak hours from historical crowd_count averages.
    """
    col = get_crowd_logs_col()
    pipeline = [
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%H:00", "date": "$timestamp"}
                },
                "avg_count": {"$avg": "$crowd_count"},
            }
        },
        {"$sort": {"avg_count": -1}},
    ]
    results = await col.aggregate(pipeline).to_list(length=None)
    if not results:
        return {"peak_hour": "N/A", "expected_count": 0, "hourly_averages": []}

    peak = results[0]
    return {
        "peak_hour":      peak["_id"],
        "expected_count": round(float(peak["avg_count"])),
        "hourly_averages": [
            {"hour": r["_id"], "avg": round(float(r["avg_count"]))}
            for r in results[:5]
        ],
    }


# ══════════════════════════════════════════════════════════════════════════
#  ALERTS
# ══════════════════════════════════════════════════════════════════════════
@router.post("/alerts/log")
async def log_alert(req: AlertRequest):
    col = get_alert_logs_col()
    doc = {
        "crowd_count":  req.crowd_count,
        "max_capacity": req.max_capacity,
        "severity":     req.severity,
        "message":      req.message,
        "is_resolved":  False,
        "resolved_at":  None,
        "triggered_at": utcnow(),
    }
    result = await col.insert_one(doc)

    # Send email for critical alerts
    if req.severity == "critical":
        users_col = get_users_col()
        recipients = await users_col.find({
            "role":      {"$in": ["admin", "manager", "security"]},
            "is_active": True,
            "email":     {"$exists": True, "$ne": "", "$ne": None},
        }).to_list(length=None)

        if recipients:
            body = (
                f"⚠️ CRITICAL ALERT: {req.message}\n\n"
                f"Current Count: {req.crowd_count}\n"
                f"Max Capacity:  {req.max_capacity}\n"
                f"Time: {utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
                f"Please take immediate action.\n\nAI Crowd Control System"
            )
            for user in recipients:
                if user.get("email"):
                    send_email(user["email"], "CRITICAL: Crowd Capacity Reached", body)

    return {"saved": True, "id": str(result.inserted_id)}


@router.get("/alerts")
async def get_alerts(
    resolved: bool = False,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    col = get_alert_logs_col()
    query: dict = {"is_resolved": resolved}

    if from_date and to_date:
        try:
            start = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
            end   = (datetime.fromisoformat(to_date) + timedelta(days=1)).replace(tzinfo=timezone.utc)
            query["triggered_at"] = {"$gte": start, "$lt": end}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    cursor = col.find(query).sort("triggered_at", -1).limit(100)
    rows = await cursor.to_list(length=100)
    return [
        {
            "id":           str(r["_id"]),
            "crowd_count":  r.get("crowd_count"),
            "max_capacity": r.get("max_capacity"),
            "severity":     r.get("severity"),
            "message":      r.get("message"),
            "is_resolved":  r.get("is_resolved", False),
            "resolved_at":  r["resolved_at"].isoformat() if r.get("resolved_at") else None,
            "triggered_at": r["triggered_at"].isoformat() if r.get("triggered_at") else None,
        }
        for r in rows
    ]


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    col = get_alert_logs_col()
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    result = await col.update_one(
        {"_id": oid},
        {"$set": {"is_resolved": True, "resolved_at": utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"resolved": True}


# ══════════════════════════════════════════════════════════════════════════
#  USERS
# ══════════════════════════════════════════════════════════════════════════
@router.get("/users")
async def get_users():
    col = get_users_col()
    rows = await col.find({}).to_list(length=None)
    return [_user_out(r) for r in rows]


@router.post("/users")
async def create_user(req: UserRequest):
    col = get_users_col()
    if await col.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    doc = {
        "username":    req.username,
        "password":    hash_password(req.password),
        "role":        req.role,
        "email":       req.email or "",
        "full_name":   req.full_name or "",
        "department":  req.department or "",
        "is_active":   req.is_active,
        "created_at":  utcnow(),
        "last_login":  None,
        "reset_token": None,
    }
    result = await col.insert_one(doc)
    return {"saved": True, "id": str(result.inserted_id)}


@router.put("/users/{user_id}")
async def update_user(user_id: str, req: UserRequest):
    col = get_users_col()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    existing = await col.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    update: dict = {
        "username":   req.username,
        "role":       req.role,
        "email":      req.email or "",
        "full_name":  req.full_name or "",
        "department": req.department or "",
        "is_active":  req.is_active,
    }
    # Only update password if a non-empty new one was provided
    if req.password:
        update["password"] = hash_password(req.password)

    await col.update_one({"_id": oid}, {"$set": update})
    return {"updated": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    col = get_users_col()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    result = await col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"deleted": True}


@router.post("/users/login")
async def login_user(req: dict):
    col = get_users_col()
    user = await col.find_one({"username": req.get("username")})

    if not user or not verify_password(req.get("password", ""), user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        admin = await col.find_one({"role": "admin", "is_active": True})
        admin_email = (admin or {}).get("email") or "admin@institution.com"
        raise HTTPException(status_code=403, detail=f"INACTIVE:{admin_email}")

    await col.update_one({"_id": user["_id"]}, {"$set": {"last_login": utcnow()}})
    return {
        "id":         str(user["_id"]),
        "username":   user["username"],
        "role":       user["role"],
        "full_name":  user.get("full_name"),
        "department": user.get("department"),
    }


@router.put("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str):
    col = get_users_col()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user = await col.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = not user.get("is_active", True)
    await col.update_one({"_id": oid}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}


@router.put("/users/{user_id}/change-password")
async def change_password(user_id: str, req: ChangePasswordRequest):
    col = get_users_col()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user = await col.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(req.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    await col.update_one({"_id": oid}, {"$set": {"password": hash_password(req.new_password)}})
    return {"changed": True}


@router.post("/users/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    import secrets, re
    col = get_users_col()

    if not re.match(r'^[\w.+-]+@[\w-]+\.[\w.]+$', req.email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    user = await col.find_one({
        "username": req.username,
        "role":     req.role,
        "email":    req.email,
    })
    if not user:
        raise HTTPException(status_code=404, detail="No account found matching username, role and email")

    token = secrets.token_urlsafe(32)
    # Store token in dedicated reset_token field — password is never touched
    await col.update_one({"_id": user["_id"]}, {"$set": {"reset_token": token}})

    reset_link = f"http://localhost:3000?reset_token={token}"
    body = (
        f"Hello {user.get('full_name') or user['username']},\n\n"
        f"You requested a password reset for AI Crowd Control System.\n\n"
        f"Your reset token is: {token}\n\n"
        f"Or click: {reset_link}\n\n"
        f"If you did not request this, ignore this email.\n\nAI Crowd Control System"
    )
    sent = send_email(req.email, "Password Reset - AI Crowd Control System", body)
    if not sent:
        # Dev mode: return token directly so the system works without SMTP
        return {"sent": False, "token": token, "dev_note": "SMTP not configured — token returned for dev use"}
    return {"sent": True}


@router.post("/users/reset-password")
async def reset_password(req: ResetPasswordRequest):
    col = get_users_col()
    user = await col.find_one({"reset_token": req.token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await col.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(req.new_password), "reset_token": None}}
    )
    return {"reset": True}


@router.post("/users/request-activation")
async def request_activation(req: ActivationRequest):
    col = get_users_col()
    admin = await col.find_one({"role": "admin", "is_active": True})
    if not admin or not admin.get("email"):
        return {"sent": False, "admin_email": None}
    body = (
        f"Hello Admin,\n\n"
        f"User '{req.username}' is requesting account activation.\n"
        f"Their contact email: {req.email}\n\n"
        f"Please log in to the AI Crowd Control System and activate their account.\n\n"
        f"AI Crowd Control System"
    )
    sent = send_email(admin["email"], f"Activation Request from {req.username}", body)
    return {"sent": sent, "admin_email": admin["email"]}
