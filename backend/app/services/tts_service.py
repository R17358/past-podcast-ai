"""
Text-to-speech via ElevenLabs. Returns raw mp3 bytes so the router can
stream them straight back to the browser — nothing is written to disk,
which keeps this safe to run on read-only/ephemeral hosting like Render.
"""
import httpx
from elevenlabs.client import ElevenLabs

from app.config import settings

_http_client = httpx.Client(timeout=60.0)
_client = ElevenLabs(api_key=settings.ELEVEN_LAB_API_KEY, httpx_client=_http_client)


def synthesize_speech(text: str, voice_id: str | None = None) -> bytes:
    voice = voice_id or settings.DEFAULT_VOICE_ID
    audio_generator = _client.text_to_speech.convert(
        voice_id=voice,
        text=text,
        model_id="eleven_flash_v2_5",
        voice_settings={"stability": 0.5, "similarity_boost": 0.75},
    )
    return b"".join(audio_generator)
