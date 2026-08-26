"""
Supported conversation languages. Add an entry here and it becomes selectable
in the frontend's language dropdown, is understood by the LLM prompt, and is
used to set the correct browser speech-recognition locale.
"""
from app.models.schemas import Language

SUPPORTED_LANGUAGES = [
    Language(code="en", label="English", speech_locale="en-US"),
    Language(code="hi", label="हिंदी (Hindi)", speech_locale="hi-IN"),
    Language(code="mr", label="मराठी (Marathi)", speech_locale="mr-IN"),
    Language(code="bn", label="বাংলা (Bengali)", speech_locale="bn-IN"),
    Language(code="ta", label="தமிழ் (Tamil)", speech_locale="ta-IN"),
    Language(code="te", label="తెలుగు (Telugu)", speech_locale="te-IN"),
    Language(code="gu", label="ગુજરાતી (Gujarati)", speech_locale="gu-IN"),
    Language(code="es", label="Español (Spanish)", speech_locale="es-ES"),
    Language(code="fr", label="Français (French)", speech_locale="fr-FR"),
]

_BY_CODE = {lang.code: lang for lang in SUPPORTED_LANGUAGES}


def get_language(code: str) -> Language:
    return _BY_CODE.get((code or "en").lower(), _BY_CODE["en"])
