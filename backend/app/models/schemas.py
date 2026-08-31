"""
All request/response data shapes live here. Keeping schemas separate from
routers/services makes it trivial to see the full "API contract" at a glance.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class Character(BaseModel):
    id: str
    name: str
    title: str = ""                 # e.g. "Father of Physics"
    era: str = ""                    # e.g. "1643 - 1727"
    description: str                 # short human-facing description
    persona_prompt: str               # full system instruction used by the LLM
    voice_id: Optional[str] = None    # ElevenLabs voice id, falls back to default
    avatar_emoji: str = "🧑\u200d🏫"
    avatar_url: Optional[str] = None  # Cloudinary photo URL — takes priority over avatar_emoji when set
    locked: bool = False              # for the "unlock new character" feature
    unlock_hint: Optional[str] = None


class AddCharacterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=3)
    era: Optional[str] = ""
    title: Optional[str] = ""
    voice_id: Optional[str] = None
    avatar_emoji: Optional[str] = "🧑\u200d🎓"
    avatar_url: Optional[str] = None


class UpdateCharacterRequest(BaseModel):
    """All fields optional — only the ones provided get updated."""
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=3)
    era: Optional[str] = None
    title: Optional[str] = None
    voice_id: Optional[str] = None
    avatar_emoji: Optional[str] = None
    avatar_url: Optional[str] = None


class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    character_id: str
    session_id: str
    message: str
    language: Optional[str] = "en"   # BCP-47-ish code: en, hi, mr, ...


class ChatResponse(BaseModel):
    character_id: str
    reply: str
    history: List[ChatMessage]


class VoiceRequest(BaseModel):
    character_id: str
    text: str
    language: Optional[str] = "en"


class Language(BaseModel):
    code: str
    label: str
    speech_locale: str   # locale tag for the browser's SpeechRecognition API


# --- Auth ---

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., min_length=10)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    auth_provider: str = "password"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UploadResponse(BaseModel):
    url: str


# --- Vision (on-demand camera input, e.g. "look at this, Sherlock") ---

class VisionRequest(BaseModel):
    character_id: str
    session_id: str
    image_base64: str          # data URL or raw base64 (no "data:image/..." prefix required)
    question: Optional[str] = "What do you see in this image?"
    language: Optional[str] = "en"


class VisionResponse(BaseModel):
    character_id: str
    reply: str
