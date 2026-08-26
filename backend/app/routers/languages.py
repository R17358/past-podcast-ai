from fastapi import APIRouter

from app.models.schemas import Language
from app.data.languages import SUPPORTED_LANGUAGES

router = APIRouter(prefix="/api/languages", tags=["languages"])


@router.get("", response_model=list[Language])
def list_languages():
    return SUPPORTED_LANGUAGES
