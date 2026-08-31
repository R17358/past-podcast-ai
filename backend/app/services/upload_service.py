"""
Thin wrapper around Cloudinary for avatar photo uploads (character portraits
+ user profile pictures). Kept as its own service, same pattern as
tts_service.py, so the actual provider stays a one-file swap later.
"""
import uuid

import cloudinary
import cloudinary.uploader

from app.config import settings

_configured = False


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return
    if not (settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET):
        raise RuntimeError(
            "Cloudinary isn't configured on the server — set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the backend .env."
        )
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configured = True


def upload_avatar(file_bytes: bytes) -> str:
    """Uploads an image and returns its secure (https) Cloudinary URL,
    resized/cropped to a square avatar so every avatar in the UI is
    consistent regardless of what the user uploaded."""
    _ensure_configured()
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="hall-of-sages/avatars",
        public_id=str(uuid.uuid4()),
        transformation=[{"width": 512, "height": 512, "crop": "fill", "gravity": "face"}],
        overwrite=True,
        resource_type="image",
    )
    return result["secure_url"]
