"""
Platform-wide subscription via Razorpay. One plan, one price (see
config.SUBSCRIPTION_PRICE_PAISE) — buying it unlocks every character whose
access_type is "subscription", for SUBSCRIPTION_DURATION_DAYS.

Flow: frontend calls /create-order -> gets a Razorpay order_id -> opens the
Razorpay Checkout widget -> on success, frontend calls /verify with the
payment details -> we verify the HMAC signature server-side (never trust the
frontend alone) -> flip the user's subscription flag + expiry.
"""
import datetime
import hashlib
import hmac

from app.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
            raise RuntimeError(
                "Razorpay isn't configured on the server — set RAZORPAY_KEY_ID and "
                "RAZORPAY_KEY_SECRET in the backend .env."
            )
        import razorpay
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return _client


def create_order(receipt: str) -> dict:
    client = _get_client()
    return client.order.create({
        "amount": settings.SUBSCRIPTION_PRICE_PAISE,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
    })


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Razorpay's documented verification: HMAC-SHA256 of "order_id|payment_id"
    using the key secret, compared against the signature Razorpay returned to
    the frontend after a successful payment."""
    if not settings.RAZORPAY_KEY_SECRET:
        return False
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(), body.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def subscription_expiry_from_now() -> datetime.datetime:
    return datetime.datetime.utcnow() + datetime.timedelta(days=settings.SUBSCRIPTION_DURATION_DAYS)
