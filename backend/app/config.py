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
    ELEVEN_LAB_API_KEY: str = os.getenv("ELEVEN_LAB_API", "")

    # Default TTS voice used when a character doesn't define its own voice_id
    DEFAULT_VOICE_ID: str = os.getenv("DEFAULT_VOICE_ID", "kL9K8Oa7kpcfpt2kQBzY")

    # Gemini model used for both chat and for auto-generating new character personas
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Where character data (default + user-added) is stored
    CHARACTERS_FILE: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app", "data", "characters.json"
    )

    # Comma separated list of allowed frontend origins for CORS
    ALLOWED_ORIGINS: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")


settings = Settings()
