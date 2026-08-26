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


def synthesize_speech(text: str, voice_id: str | None = None, language: str = "en") -> bytes:
    if not settings.ELEVEN_LAB_API_KEY:
        raise RuntimeError(
            "ELEVEN_LAB_API key is missing on the server (.env). Voice output can't work without it."
        )
    if not text or not text.strip():
        raise RuntimeError("No text to speak.")

    voice = voice_id or settings.DEFAULT_VOICE_ID
    # eleven_flash_v2_5 is fast but English-leaning; switch to the multilingual
    # model whenever the reply isn't English so Hindi/Marathi/etc. sound right.
    model_id = "eleven_flash_v2_5" if language == "en" else "eleven_multilingual_v2"

    audio_generator = _client.text_to_speech.convert(
        voice_id=voice,
        text=text,
        model_id=model_id,
        voice_settings={"stability": 0.5, "similarity_boost": 0.75},
    )
    audio_bytes = b"".join(audio_generator)
    if not audio_bytes:
        raise RuntimeError("ElevenLabs returned empty audio.")
    return audio_bytes
