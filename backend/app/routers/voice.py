from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.schemas import VoiceRequest
from app.services import character_store, tts_service

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("")
def synthesize(payload: VoiceRequest):
    """
    Called only when the user taps the 'listen' button on a reply —
    keeps ElevenLabs usage (and cost) opt-in per message, not automatic.
    """
    character = character_store.get_character(payload.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    try:
        audio_bytes = tts_service.synthesize_speech(payload.text, character.voice_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS error: {exc}")

    return Response(content=audio_bytes, media_type="audio/mpeg")
