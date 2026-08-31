"""
Auth is intentionally optional everywhere it touches chat/voice/vision:
a logged-in user gets their conversation memory tied to their account
(persists across devices), a guest gets memory tied to their browser
session_id only (works immediately, no signup wall, matches how the app
behaved before auth existed). Only a couple of endpoints (signup/login/me)
require a real, verified user.
"""
import datetime
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header
from passlib.context import CryptContext

from app.config import settings
from app.db import users_collection

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_google_id_token(token: str) -> dict:
    """
    Verifies a Google ID token (sent from the frontend's Google Identity
    Services button) against our OAuth client ID and returns the decoded
    payload (contains sub/email/name/picture). Raises HTTPException on any
    invalid/expired/mismatched-audience token.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in isn't configured on the server (GOOGLE_CLIENT_ID missing).",
        )
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        payload = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in token")
    return payload


def get_or_create_google_user(payload: dict) -> dict:
    """Finds the user by Google sub/email, or creates a new google-auth-only
    account (no password_hash) the first time someone signs in with Google."""
    email = (payload.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    user = users_collection.find_one({"email": email})
    if user:
        # Backfill provider info + avatar for accounts that existed before Google login was added
        updates = {}
        if not user.get("google_id"):
            updates["google_id"] = payload.get("sub")
        if not user.get("avatar_url") and payload.get("picture"):
            updates["avatar_url"] = payload.get("picture")
        if updates:
            users_collection.update_one({"_id": user["_id"]}, {"$set": updates})
            user.update(updates)
        return user

    new_user = {
        "name": payload.get("name") or email.split("@")[0],
        "email": email,
        "password_hash": None,
        "google_id": payload.get("sub"),
        "avatar_url": payload.get("picture"),
        "auth_provider": "google",
        "role": "user",
        "points": 0,
        "unlocked_character_ids": [],
        "subscription_active": False,
    }
    result = users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    return new_user


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def create_access_token(user_id: str) -> str:
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY is missing on the server (.env) — set it to any long "
            "random string before auth can issue tokens."
        )
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Returns the user's Mongo _id (as a string) if a valid Bearer token was
    sent, otherwise None — never raises, so guest requests still work."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return _decode_token(token)


def get_current_user(user_id: Optional[str] = Depends(get_optional_user_id)) -> dict:
    """Use as a dependency on routes that REQUIRE a logged-in user (e.g. /me)."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from bson import ObjectId  # local import: only auth routes need bson directly

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(user_id: Optional[str] = Depends(get_optional_user_id)) -> Optional[dict]:
    """Like get_current_user, but returns None instead of raising when
    there's no (or an invalid) token — for endpoints like the character list
    that work for everyone but need to know WHO's asking to compute
    per-user unlock status."""
    if not user_id:
        return None
    from bson import ObjectId

    return users_collection.find_one({"_id": ObjectId(user_id)})


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Use as a dependency on admin-only routes (adding/editing characters,
    managing quizzes). Regular users get a 403, not just a hidden button —
    the UI hiding the button is a convenience, this is the actual gate."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
