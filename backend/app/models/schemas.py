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
    locked: bool = False              # for the "unlock new character" feature
    unlock_hint: Optional[str] = None


class AddCharacterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=3)
    era: Optional[str] = ""
    title: Optional[str] = ""
    voice_id: Optional[str] = None
    avatar_emoji: Optional[str] = "🧑\u200d🎓"


class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    character_id: str
    session_id: str
    message: str


class ChatResponse(BaseModel):
    character_id: str
    reply: str
    history: List[ChatMessage]


class VoiceRequest(BaseModel):
    character_id: str
    text: str
