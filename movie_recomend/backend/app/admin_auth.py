"""
MovieMind Administrator Authentication & Access Control Layer.
Handles secure administrator authentication, session tokens, HttpOnly cookies,
rate limiting, and role-based access validation.
"""
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import logging
from threading import Lock

import bcrypt
from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from app.config import (
    ADMIN_COOKIE_NAME,
    ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH,
    ADMIN_SESSION_EXPIRE_MINUTES,
    ADMIN_USERNAME,
    JWT_ALGORITHM,
    get_jwt_secret,
)
from app.auth import get_current_user, UserResponse

logger = logging.getLogger("MovieMind.AdminAuth")

# Lock and storage for in-memory brute force protection
_rate_limit_lock = Lock()
_failed_attempts: Dict[str, List[float]] = {}
MAX_FAILED_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes


# Initialize or retrieve admin password hash
def _get_admin_password_hash() -> str:
    if ADMIN_PASSWORD_HASH and ADMIN_PASSWORD_HASH.strip():
        return ADMIN_PASSWORD_HASH.strip()
    # Compute deterministic bcrypt hash for the configured admin password
    return bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


_ADMIN_HASH = _get_admin_password_hash()


class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)


class AdminProfile(BaseModel):
    username: str
    role: str = "admin"
    authenticated: bool = True
    display_name: str = "System Administrator"


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminProfile
    expires_in_minutes: int


def _is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    with _rate_limit_lock:
        attempts = _failed_attempts.get(client_ip, [])
        # Keep only recent failures
        attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW_SECONDS]
        _failed_attempts[client_ip] = attempts
        return len(attempts) >= MAX_FAILED_ATTEMPTS


def _record_failed_attempt(client_ip: str) -> None:
    now = time.time()
    with _rate_limit_lock:
        attempts = _failed_attempts.get(client_ip, [])
        attempts.append(now)
        _failed_attempts[client_ip] = attempts


def _clear_failed_attempts(client_ip: str) -> None:
    with _rate_limit_lock:
        if client_ip in _failed_attempts:
            del _failed_attempts[client_ip]


def create_admin_session_token() -> str:
    jwt_secret = get_jwt_secret()
    if not jwt_secret:
        raise RuntimeError("MOVIEMIND_JWT_SECRET must be configured")
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=ADMIN_SESSION_EXPIRE_MINUTES)
    payload = {
        "sub": ADMIN_USERNAME,
        "role": "admin",
        "type": "admin_session",
        "exp": expires,
        "iat": now,
    }
    return jwt.encode(payload, jwt_secret, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> Dict[str, Any]:
    jwt_secret = get_jwt_secret()
    if not jwt_secret:
        raise HTTPException(status_code=500, detail="Authentication secret not configured")
    try:
        payload: Dict[str, Any] = jwt.decode(token, jwt_secret, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "admin" or payload.get("sub") != ADMIN_USERNAME:
            raise ValueError("Invalid admin payload")
        return payload
    except (JWTError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired administrator session",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_admin(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> AdminProfile:
    """
    Dependency that enforces an active administrator session.
    Inspects:
    1. Header `X-Admin-Token: <token>`
    2. HttpOnly cookie `moviemind_admin_session`
    3. Header `Authorization: Bearer <token>`
    """
    candidate_tokens = []

    admin_header = request.headers.get("x-admin-token")
    if admin_header:
        candidate_tokens.append(admin_header)

    cookie_token = request.cookies.get(ADMIN_COOKIE_NAME)
    if cookie_token:
        candidate_tokens.append(cookie_token)

    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            candidate_tokens.append(parts[1])

    if not candidate_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    for tok in candidate_tokens:
        try:
            verify_admin_token(tok)
            return AdminProfile(username=ADMIN_USERNAME, role="admin", authenticated=True)
        except HTTPException:
            continue

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Administrator authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_admin(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[AdminProfile]:
    """Returns AdminProfile if valid admin session exists, else None without raising."""
    try:
        return get_current_admin(request=request, authorization=authorization)
    except HTTPException:
        return None


def require_admin_or_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Allows either an authenticated administrator OR an authenticated user.
    Enables shared endpoints (such as movie searches or ratings).
    """
    # First test admin session
    admin = get_optional_admin(request=request, authorization=authorization)
    if admin:
        return {"role": "admin", "username": admin.username, "id": 0}

    # Otherwise check regular user
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split()[1]
        try:
            user = get_current_user(token=token)
            return {"role": "user", "username": user.username, "id": user.id, "user": user}
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required (Admin or User)",
        headers={"WWW-Authenticate": "Bearer"},
    )


def login_admin(
    credentials: AdminLoginRequest,
    request: Request,
    response: Response,
) -> AdminTokenResponse:
    client_ip = request.client.host if request.client else "unknown"

    if _is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 5 minutes before trying again.",
        )

    valid_username = credentials.username.strip() == ADMIN_USERNAME
    valid_password = False
    if valid_username:
        try:
            valid_password = bcrypt.checkpw(
                credentials.password.encode("utf-8"),
                _ADMIN_HASH.encode("utf-8"),
            )
        except Exception as e:
            logger.error("Error verifying admin password: %s", e)

    if not (valid_username and valid_password):
        _record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Success: reset rate limit attempts
    _clear_failed_attempts(client_ip)

    # Create admin session token
    token = create_admin_session_token()

    # Set secure HttpOnly cookie
    max_age_seconds = ADMIN_SESSION_EXPIRE_MINUTES * 60
    is_secure = request.url.scheme == "https"

    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        max_age=max_age_seconds,
        expires=max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        path="/",
    )

    logger.info("Admin login successful for '%s' from IP %s", ADMIN_USERNAME, client_ip)
    return AdminTokenResponse(
        access_token=token,
        token_type="bearer",
        admin=AdminProfile(username=ADMIN_USERNAME, role="admin", authenticated=True),
        expires_in_minutes=ADMIN_SESSION_EXPIRE_MINUTES,
    )


def logout_admin(response: Response) -> Dict[str, str]:
    response.delete_cookie(
        key=ADMIN_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"message": "Administrator session successfully logged out", "status": "success"}
