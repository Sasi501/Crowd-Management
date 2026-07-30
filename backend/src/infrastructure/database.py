"""
MongoDB database configuration using Motor (async driver).

Collections:
  users       — login accounts
  crowd_logs  — every crowd-count change event
  alert_logs  — capacity alert records
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel
import logging

from src.config import settings

logger = logging.getLogger(__name__)

# ── Client & database ──────────────────────────────────────────────────────
# A single Motor client is created at module level and reused across requests.
# Motor manages its own internal connection pool.
_client: AsyncIOMotorClient = None
_db = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_database():
    global _db
    if _db is None:
        _db = get_client()[settings.mongodb_db]
    return _db


# ── Collection accessors ───────────────────────────────────────────────────
def get_users_col():
    return get_database()["users"]

def get_crowd_logs_col():
    return get_database()["crowd_logs"]

def get_alert_logs_col():
    return get_database()["alert_logs"]


# ── Index creation on startup ──────────────────────────────────────────────
async def init_database():
    """
    Called once at application startup.
    Creates indexes so queries are fast even with large collections.
    """
    try:
        db = get_database()

        # users: unique index on username
        await db["users"].create_index("username", unique=True)
        await db["users"].create_index("reset_token", sparse=True)

        # crowd_logs: timestamp descending for recent-first queries
        await db["crowd_logs"].create_index([("timestamp", DESCENDING)])

        # alert_logs: timestamp descending + is_resolved for filter queries
        await db["alert_logs"].create_index([("triggered_at", DESCENDING)])
        await db["alert_logs"].create_index("is_resolved")

        logger.info("MongoDB indexes ensured successfully")
    except Exception as e:
        logger.error(f"Failed to create MongoDB indexes: {e}")
        raise


async def close_database():
    """Called on application shutdown to cleanly close the connection."""
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed")
