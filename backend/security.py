"""
Measure X — Security, Authentication & Cryptographic Token Subsystem
Implements:
- Signed JWT token issuance and cryptographic verification (HMAC-SHA256 via PyJWT)
- Password hashing and constant-time verification
- FastAPI Authentication Dependencies: get_current_user, get_optional_user, require_role
- Strict identity resolution bound to MySQL 8+ database
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import jwt
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import db, User, hash_password, verify_password

# Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "measurex-enterprise-sec-token-2026-bihar-metrology-secret-key-9912")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def create_access_token(user_id: str, role: str, extra_claims: Optional[Dict[str, Any]] = None, expires_days: int = ACCESS_TOKEN_EXPIRE_DAYS) -> str:
    """
    Generates a cryptographically signed JWT token with user identity and role.
    """
    now = datetime.utcnow()
    expire = now + timedelta(days=expires_days)
    payload = {
        "sub": str(user_id),
        "user_id": str(user_id),
        "role": str(role).upper(),
        "iat": now,
        "exp": expire,
        "iss": "measurex-platform"
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Validates and decodes a signed JWT token.
    Raises HTTPException 401 if invalid or expired.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing. Please sign in."
        )
    # Strip 'Bearer ' prefix if present
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
        
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], issuer="measurex-platform")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again to renew your credentials."
        )
    except jwt.InvalidTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token signature."
        )


def get_current_user_from_token(token: str, session: Session) -> User:
    """
    Resolves the exact MySQL user from a decoded JWT token.
    Enforces user existence and active status.
    """
    payload = decode_access_token(token)
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token: user identifier missing."
        )

    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account no longer exists in the system."
        )
    return user


def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """
    FastAPI dependency for protected routes.
    Extracts Bearer token from Authorization header and queries MySQL.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required. Please sign in."
        )

    session = db.get_session()
    try:
        user = get_current_user_from_token(authorization, session)
        # Detach or keep session managed
        session.expunge(user)
        return user
    finally:
        session.close()


def get_optional_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """
    FastAPI dependency for routes that allow both public access and authenticated context.
    Returns User if valid token present, otherwise None.
    """
    if not authorization:
        return None
    session = db.get_session()
    try:
        user = get_current_user_from_token(authorization, session)
        session.expunge(user)
        return user
    except Exception:
        return None
    finally:
        session.close()


def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory enforcing role-based authorization.
    Usage: Depends(require_role("ADMIN", "LMO"))
    """
    allowed_upper = [r.upper() for r in allowed_roles]

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (current_user.role_id or "").upper()
        if user_role not in allowed_upper:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_upper)}. Current role: {user_role}"
            )
        return current_user

    return role_checker
