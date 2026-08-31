"""
Single MongoDB connection shared by the whole app.

Three collections:
- users          -> signup/login accounts
- characters     -> now the source of truth for characters (was characters.json)
- conversations  -> persisted chat memory, keyed by (owner_key, character_id)
                    where owner_key is the user_id for logged-in users, or
                    "guest:<session_id>" for anonymous browser sessions.

Everything else in the app (routers/services) only ever calls the helpers in
this file or in services/character_store.py — nothing else talks to pymongo
directly, so swapping the DB later stays a one-file change.
"""
import json
import sys

from pymongo import MongoClient, ASCENDING
from pymongo.errors import ServerSelectionTimeoutError

from app.config import settings

_client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
_db = _client[settings.MONGODB_DB_NAME]

users_collection = _db["users"]
characters_collection = _db["characters"]
conversations_collection = _db["conversations"]


def init_db() -> None:
    """
    Called once at startup (see main.py). Verifies the connection, creates
    indexes, and seeds `characters` from the original characters.json the
    very first time the app runs against a fresh database.
    """
    try:
        _client.admin.command("ping")
    except ServerSelectionTimeoutError as exc:
        print(
            "\n[FATAL] Could not reach MongoDB at "
            f"{settings.MONGODB_URI!r} — is MONGODB_URI set correctly in your "
            ".env / Render environment variables? Original error: "
            f"{exc}\n",
            file=sys.stderr,
        )
        raise

    users_collection.create_index("email", unique=True)
    users_collection.create_index("google_id", sparse=True)
    characters_collection.create_index("id", unique=True)
    conversations_collection.create_index(
        [("owner_key", ASCENDING), ("character_id", ASCENDING)], unique=True
    )

    if characters_collection.count_documents({}) == 0:
        _seed_characters_from_json()


def _seed_characters_from_json() -> None:
    try:
        with open(settings.CHARACTERS_FILE, "r", encoding="utf-8") as f:
            characters = json.load(f)
    except FileNotFoundError:
        return
    if characters:
        characters_collection.insert_many(characters)
        print(f"[startup] Seeded {len(characters)} characters into MongoDB from characters.json")
