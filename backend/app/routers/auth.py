from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import users_collection
from app.models.schemas import LoginRequest, SignupRequest, TokenResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    return UserOut(id=str(doc["_id"]), name=doc["name"], email=doc["email"])


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest):
    try:
        result = users_collection.insert_one({
            "name": payload.name,
            "email": payload.email.lower().strip(),
            "password_hash": auth_service.hash_password(payload.password),
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = users_collection.find_one({"_id": result.inserted_id})
    token = auth_service.create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = users_collection.find_one({"email": payload.email.lower().strip()})
    if not user or not auth_service.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth_service.create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(auth_service.get_current_user)):
    return _user_out(user)
