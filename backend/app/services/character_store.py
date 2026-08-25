"""
Very small "database": characters live in a JSON file on disk.
This keeps the project dependency-free (no SQL setup needed) while still
being easy to swap for a real DB later — every other part of the app only
talks to the functions below, never to the file directly.
"""
import json
import os
import re
import threading
from typing import List, Optional

from app.config import settings
from app.models.schemas import Character

_lock = threading.Lock()


def _read_all() -> List[dict]:
    if not os.path.exists(settings.CHARACTERS_FILE):
        return []
    with open(settings.CHARACTERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_all(characters: List[dict]) -> None:
    with open(settings.CHARACTERS_FILE, "w", encoding="utf-8") as f:
        json.dump(characters, f, ensure_ascii=False, indent=2)


def list_characters() -> List[Character]:
    return [Character(**c) for c in _read_all()]


def get_character(character_id: str) -> Optional[Character]:
    for c in _read_all():
        if c["id"] == character_id:
            return Character(**c)
    return None


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "character"


def _unique_id(base_id: str, existing_ids: set) -> str:
    if base_id not in existing_ids:
        return base_id
    i = 2
    while f"{base_id}-{i}" in existing_ids:
        i += 1
    return f"{base_id}-{i}"


def add_character(name: str, description: str, persona_prompt: str,
                   era: str = "", title: str = "",
                   voice_id: Optional[str] = None,
                   avatar_emoji: str = "🧑\u200d🎓") -> Character:
    with _lock:
        characters = _read_all()
        existing_ids = {c["id"] for c in characters}
        new_id = _unique_id(_slugify(name), existing_ids)

        new_character = Character(
            id=new_id,
            name=name,
            title=title,
            era=era,
            description=description,
            persona_prompt=persona_prompt,
            voice_id=voice_id,
            avatar_emoji=avatar_emoji,
            locked=False,
        )
        characters.append(json.loads(new_character.model_dump_json()))
        _write_all(characters)
        return new_character
