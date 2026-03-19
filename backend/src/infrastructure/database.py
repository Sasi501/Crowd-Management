"""
Database configuration and SQLAlchemy models
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
import pymysql
pymysql.install_as_MySQLdb()

from src.config import settings

DATABASE_URL = settings.database_url
if DATABASE_URL.startswith("mysql") and "charset" not in DATABASE_URL:
    DATABASE_URL += ("&" if "?" in DATABASE_URL else "?") + "charset=utf8mb4"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_database():
    """Create DB + all tables if they don't exist"""
    if DATABASE_URL.startswith("mysql"):
        from urllib.parse import urlparse
        from sqlalchemy import text
        parsed = urlparse(DATABASE_URL)
        db_name = parsed.path.lstrip('/').split('?')[0]
        base_url = f"{parsed.scheme}://{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port or 3306}"
        tmp = create_engine(base_url)
        with tmp.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            conn.commit()
        tmp.dispose()
    Base.metadata.create_all(bind=engine)


# ── Users ──────────────────────────────────────────────────────────────────
class UserDB(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(100), unique=True, nullable=False, index=True)
    password   = Column(String(255), nullable=False)
    role       = Column(String(50),  nullable=False)
    email      = Column(String(255), nullable=True)
    full_name  = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


# ── Crowd logs (one row per count change) ─────────────────────────────────
class CrowdLogDB(Base):
    """
    Stores every crowd-count snapshot.
    mode   : 'line_crossing' | 'dual_camera'
    source : 'in' | 'out' | 'line'   (which camera/line triggered it)
    """
    __tablename__ = "crowd_logs"
    id            = Column(Integer, primary_key=True, index=True)
    mode          = Column(Enum("line_crossing", "dual_camera"), nullable=False)
    source        = Column(String(20), nullable=False)          # 'in' / 'out' / 'line'
    crowd_count   = Column(Integer, nullable=False)             # total crowd at this moment
    delta         = Column(Integer, nullable=False)             # +1 or -1
    confidence    = Column(Float,   nullable=True)
    person_id     = Column(Integer, nullable=True)              # tracked person ID
    timestamp     = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ── Alerts ─────────────────────────────────────────────────────────────────
class AlertLogDB(Base):
    """
    Fired whenever crowd_count crosses max_capacity threshold.
    severity: 'warning' (>=70%) | 'critical' (>=100%)
    """
    __tablename__ = "alert_logs"
    id            = Column(Integer, primary_key=True, index=True)
    crowd_count   = Column(Integer, nullable=False)
    max_capacity  = Column(Integer, nullable=False)
    severity      = Column(Enum("warning", "critical"), nullable=False)
    message       = Column(Text,    nullable=False)
    is_resolved   = Column(Boolean, default=False)
    resolved_at   = Column(DateTime(timezone=True), nullable=True)
    triggered_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ── DB session dependency ──────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()