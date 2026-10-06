from datetime import datetime, timedelta, timezone
import re
import sqlite3
from typing import Any, Dict

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field, field_validator

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, get_jwt_secret
from app.database import get_connection

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,30}$")
PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not USERNAME_PATTERN.fullmatch(value):
            raise ValueError("Username must be 3-30 letters, numbers, or underscores")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not PASSWORD_PATTERN.fullmatch(value):
            raise ValueError("Password needs an uppercase letter, lowercase letter, and number")
        return value


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: str
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def _public_user(row: sqlite3.Row) -> UserResponse:
    return UserResponse(
        id=row["id"],
        name=row["name"],
        username=row["username"],
        email=row["email"],
        created_at=row["created_at"],
    )


def _find_user(identifier: str) -> sqlite3.Row | None:
    with get_connection() as connection:
        return connection.execute(
            "SELECT id, name, username, email, hashed_password, created_at FROM users WHERE username = ? OR email = ?",
            (identifier.strip().lower(), identifier.strip().lower()),
        ).fetchone()


def _create_access_token(user_id: int) -> str:
    jwt_secret = get_jwt_secret()
    if not jwt_secret:
        raise RuntimeError("MOVIEMIND_JWT_SECRET must be configured")
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expires, "iat": datetime.now(timezone.utc)},
        jwt_secret,
        algorithm=JWT_ALGORITHM,
    )


def register_user(payload: UserCreate) -> TokenResponse:
    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO users (name, username, email, hashed_password) VALUES (?, ?, ?, ?)",
                (payload.name, payload.username, payload.email, password_hash),
            )
            row = connection.execute(
                "SELECT id, name, username, email, created_at FROM users WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email or username is already registered")

    user = _public_user(row)
    return TokenResponse(access_token=_create_access_token(user.id), user=user)


def login_user(payload: LoginRequest) -> TokenResponse:
    row = _find_user(payload.identifier)
    valid_password = row is not None and bcrypt.checkpw(
        payload.password.encode("utf-8"), row["hashed_password"].encode("utf-8")
    )
    if not valid_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username/email or password")

    user = _public_user(row)
    return TokenResponse(access_token=_create_access_token(user.id), user=user)


def get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse:
    jwt_secret = get_jwt_secret()
    if not jwt_secret:
        raise HTTPException(status_code=500, detail="Authentication is not configured")
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload: Dict[str, Any] = jwt.decode(token, jwt_secret, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", ""))
    except (JWTError, TypeError, ValueError):
        raise credentials_error

    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, name, username, email, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if row is None:
        raise credentials_error
    return _public_user(row)
