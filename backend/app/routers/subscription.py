from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.db import users_collection
from app.models.schemas import CreateOrderResponse, SubscriptionStatus, VerifyPaymentRequest
from app.services import auth_service, character_store, subscription_service

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


@router.get("/status", response_model=SubscriptionStatus)
def status(user: dict = Depends(auth_service.get_current_user)):
    return SubscriptionStatus(
        active=character_store.is_subscription_active(user),
        expires_at=user.get("subscription_expires_at"),
        price_paise=settings.SUBSCRIPTION_PRICE_PAISE,
        duration_days=settings.SUBSCRIPTION_DURATION_DAYS,
    )


@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(user: dict = Depends(auth_service.get_current_user)):
    try:
        order = subscription_service.create_order(receipt=f"user:{user['_id']}")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not create payment order: {exc}")
    return CreateOrderResponse(
        order_id=order["id"],
        amount=order["amount"],
        currency=order.get("currency", "INR"),
        key_id=settings.RAZORPAY_KEY_ID,
    )


@router.post("/verify", response_model=SubscriptionStatus)
def verify_payment(payload: VerifyPaymentRequest, user: dict = Depends(auth_service.get_current_user)):
    ok = subscription_service.verify_signature(
        payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Payment verification failed — signature mismatch")

    expires_at = subscription_service.subscription_expiry_from_now()
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"subscription_active": True, "subscription_expires_at": expires_at}},
    )
    return SubscriptionStatus(
        active=True,
        expires_at=expires_at,
        price_paise=settings.SUBSCRIPTION_PRICE_PAISE,
        duration_days=settings.SUBSCRIPTION_DURATION_DAYS,
    )
