"""
Central place for all configuration / environment variables.
Keeping this in one file means if you ever need to add a new key
(e.g. a different LLM provider) you only touch this file.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # NOTE: this used to read "ELEVEN_LAB_API" (no _KEY suffix), which never
    # matched the actual env var name and silently produced an empty key —
    # every /api/voice call then failed. Fixed to match .env.example / hosting config.
    ELEVEN_LAB_API_KEY: str = os.getenv("ELEVEN_LAB_API_KEY", "")

    # Default TTS voice used when a character doesn't define its own voice_id
    DEFAULT_VOICE_ID: str = os.getenv("DEFAULT_VOICE_ID", "kL9K8Oa7kpcfpt2kQBzY")

    # Gemini model used for chat, persona generation, and vision (camera) replies
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Where the SEED character data lives — only used once, to populate MongoDB
    # the first time the app starts against an empty `characters` collection.
    CHARACTERS_FILE: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app", "data", "characters.json"
    )

    # Comma separated list of allowed frontend origins for CORS
    ALLOWED_ORIGINS: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")

    # --- MongoDB (users, characters, conversation memory) ---
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "character_ai")

    # --- Auth (JWT) ---
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "43200"))  # 30 days

    # --- Conversation memory / summarization ---
    # Keep this many raw turns in full; anything older gets folded into a
    # rolling summary instead of being sent to the LLM verbatim (keeps token
    # usage — and cost — roughly flat no matter how long a conversation gets).
    MEMORY_MAX_RAW_MESSAGES: int = int(os.getenv("MEMORY_MAX_RAW_MESSAGES", "16"))

    # --- Google Sign-In ---
    # OAuth client ID from https://console.cloud.google.com/apis/credentials
    # Must match VITE_GOOGLE_CLIENT_ID on the frontend — it's the audience
    # the backend checks every Google ID token against.
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # --- Cloudinary (profile / character avatar photo uploads) ---
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # --- Gamification: quiz points ---
    # Awarded per correct answer, once per (user, quiz) — see quiz_store.has_attempted.
    POINTS_PER_CORRECT_ANSWER: int = int(os.getenv("POINTS_PER_CORRECT_ANSWER", "10"))

    # --- Razorpay (platform-wide subscription) ---
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    # Amount is in paise (smallest INR unit) — 19900 = ₹199.00
    SUBSCRIPTION_PRICE_PAISE: int = int(os.getenv("SUBSCRIPTION_PRICE_PAISE", "19900"))
    SUBSCRIPTION_DURATION_DAYS: int = int(os.getenv("SUBSCRIPTION_DURATION_DAYS", "30"))


settings = Settings()
