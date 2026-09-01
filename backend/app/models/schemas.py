"""
All request/response data shapes live here. Keeping schemas separate from
routers/services makes it trivial to see the full "API contract" at a glance.
"""
import datetime
from pydantic import BaseModel, Field
from typing import Optional, List


# access_type values, referenced across characters + unlock logic:
#   "free"          — everyone can chat with this character
#   "points"        — unlockable by spending in-app points earned from quizzes
#   "subscription"  — requires an active platform subscription (any plan)
ACCESS_TYPES = ("free", "points", "subscription")


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
    category: str = "General"         # e.g. "Science", "Philosophy", "Anime" — free text, admin-set
    access_type: str = "free"         # one of ACCESS_TYPES — set by admin
    unlock_points: int = 0            # cost in points when access_type == "points"


class CharacterOut(Character):
    """What the API actually returns — adds the computed, per-viewer
    unlock status on top of the stored character document."""
    unlocked: bool = True


class AddCharacterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=3)
    era: Optional[str] = ""
    title: Optional[str] = ""
    voice_id: Optional[str] = None
    avatar_emoji: Optional[str] = "🧑\u200d🎓"
    avatar_url: Optional[str] = None
    category: Optional[str] = "General"
    access_type: Optional[str] = "free"
    unlock_points: Optional[int] = 0


class UpdateCharacterRequest(BaseModel):
    """All fields optional — only the ones provided get updated."""
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=3)
    era: Optional[str] = None
    title: Optional[str] = None
    voice_id: Optional[str] = None
    avatar_emoji: Optional[str] = None
    avatar_url: Optional[str] = None
    category: Optional[str] = None
    access_type: Optional[str] = None
    unlock_points: Optional[int] = None


class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    character_id: str
    session_id: str
    message: str
    language: Optional[str] = "en"   # BCP-47-ish code: en, hi, mr, ...
    response_length: Optional[str] = "normal"   # "short" | "normal" | "detailed"
    tone: Optional[str] = "normal"               # "normal" | "professional" | "funny" | "friendly"


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
    role: str = "user"                       # "user" | "admin"
    points: int = 0
    unlocked_character_ids: List[str] = []
    subscription_active: bool = False
    subscription_expires_at: Optional[datetime.datetime] = None


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


# --- Quizzes (gamification: earn points, spend them unlocking characters) ---

class QuizQuestion(BaseModel):
    id: str
    prompt: str
    options: List[str]
    correct_index: int
    explanation: Optional[str] = None


class Quiz(BaseModel):
    """Full stored shape — includes correct answers. Only ever sent to
    admins (see QuizPublic for what regular users get while taking a quiz)."""
    id: str
    title: str
    character_id: Optional[str] = None   # tie to one character...
    category: Optional[str] = None       # ...or a whole category — either/both/neither
    created_by: str = "admin"            # "admin" | "ai"
    questions: List[QuizQuestion]


class QuizQuestionIn(BaseModel):
    prompt: str = Field(..., min_length=3)
    options: List[str] = Field(..., min_length=2, max_length=6)
    correct_index: int = Field(..., ge=0)
    explanation: Optional[str] = None


class QuizCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    character_id: Optional[str] = None
    category: Optional[str] = None
    questions: List[QuizQuestionIn] = Field(..., min_length=1)


class QuizGenerateRequest(BaseModel):
    character_id: Optional[str] = None
    category: Optional[str] = None
    topic_hint: Optional[str] = None
    num_questions: int = Field(5, ge=1, le=15)


class QuizQuestionPublic(BaseModel):
    """What a user taking the quiz sees — no correct_index, no explanation
    (that's only revealed per-question in the submit response)."""
    id: str
    prompt: str
    options: List[str]


class QuizPublic(BaseModel):
    id: str
    title: str
    character_id: Optional[str] = None
    category: Optional[str] = None
    created_by: str
    questions: List[QuizQuestionPublic]
    already_completed: bool = False   # true if points were already earned from this quiz


class QuizSubmitRequest(BaseModel):
    answers: List[int]   # selected option index per question, same order as QuizPublic.questions


class QuizQuestionResult(BaseModel):
    question_id: str
    prompt: str
    options: List[str]
    correct_index: int
    selected_index: int
    is_correct: bool
    explanation: Optional[str] = None


class QuizSubmitResponse(BaseModel):
    quiz_id: str
    score: int
    total: int
    points_earned: int
    already_scored_before: bool   # true if this was a retake — no points awarded twice
    total_points: int             # the user's new points balance
    results: List[QuizQuestionResult]


# --- Subscription (Razorpay) ---

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int          # paise
    currency: str = "INR"
    key_id: str           # Razorpay key_id — safe to expose to the frontend checkout widget


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class SubscriptionStatus(BaseModel):
    active: bool
    expires_at: Optional[datetime.datetime] = None
    price_paise: int = 0
    duration_days: int = 0
