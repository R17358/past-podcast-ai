from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.models.schemas import UploadResponse
from app.services import auth_service, upload_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_BYTES = 8 * 1024 * 1024  # 8MB


@router.post("/image", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    user: dict = Depends(auth_service.get_current_user),  # must be signed in to upload
):
    """Uploads a profile/character avatar photo to Cloudinary and returns its URL."""
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG, WEBP or GIF image.")

    contents = await file.read()
    if len(contents) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large — please keep it under 8MB.")

    try:
        url = upload_service.upload_avatar(contents)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upload failed: {exc}")

    return UploadResponse(url=url)
