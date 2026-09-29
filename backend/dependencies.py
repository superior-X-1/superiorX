"""
Measure X — FastAPI Route Dependencies.
Provides database session injection and role-based authentication dependencies.
"""

from typing import Generator
from sqlalchemy.orm import Session
from backend.database import db
from backend.security import (
    get_current_user,
    get_optional_current_user,
    require_role
)


def get_db() -> Generator[Session, None, None]:
    """Yields an isolated, thread-safe SQLAlchemy database session."""
    session = db.get_session()
    try:
        yield session
    finally:
        session.close()


__all__ = [
    "get_db",
    "get_current_user",
    "get_optional_current_user",
    "require_role"
]
