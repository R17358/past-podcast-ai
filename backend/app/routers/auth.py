from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import users_collection
from app.models.schemas import (
    GoogleAuthRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
)
from app.services import auth_service, character_store

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        avatar_url=doc.get("avatar_url"),
        auth_provider=doc.get("auth_provider", "google" if doc.get("google_id") and not doc.get("password_hash") else "password"),
        role=doc.get("role", "user"),
        points=doc.get("points", 0),
        unlocked_character_ids=doc.get("unlocked_character_ids", []),
        subscription_active=character_store.is_subscription_active(doc),
        subscription_expires_at=doc.get("subscription_expires_at"),
    )


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest):
    try:
        result = users_collection.insert_one({
            "name": payload.name,
            "email": payload.email.lower().strip(),
            "password_hash": auth_service.hash_password(payload.password),
            "auth_provider": "password",
            "role": "user",
            "points": 0,
            "unlocked_character_ids": [],
            "subscription_active": False,
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = users_collection.find_one({"_id": result.inserted_id})
    token = auth_service.create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = users_collection.find_one({"email": payload.email.lower().strip()})
    if not user or not user.get("password_hash") or not auth_service.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth_service.create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest):
    """
    Signs in (or silently creates an account for) a user who authenticated
    with a Google ID token via Google Identity Services on the frontend.
    """
    claims = auth_service.verify_google_id_token(payload.id_token)
    user = auth_service.get_or_create_google_user(claims)
    token = auth_service.create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(auth_service.get_current_user)):
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(payload: UpdateProfileRequest, user: dict = Depends(auth_service.get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        users_collection.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
    return _user_out(user)
