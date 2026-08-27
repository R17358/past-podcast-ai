"""
Characters now live in MongoDB (`characters` collection) instead of a JSON
file. Every other part of the app only calls the functions below, never
touches the collection directly - that's what made this swap a one-file change.

The very first time the app starts against an empty collection, app/db.py's
init_db() seeds it from the original app/data/characters.json.
"""
import re
from typing import List, Optional

from app.db import characters_collection
from app.models.schemas import Character


def _to_character(doc: dict) -> Character:
    doc = {k: v for k, v in doc.items() if k != "_id"}
    return Character(**doc)


def list_characters() -> List[Character]:
    return [_to_character(doc) for doc in characters_collection.find()]


def get_character(character_id: str) -> Optional[Character]:
    doc = characters_collection.find_one({"id": character_id})
    return _to_character(doc) if doc else None


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "character"


def _unique_id(base_id: str) -> str:
    if not characters_collection.find_one({"id": base_id}):
        return base_id
    i = 2
    while characters_collection.find_one({"id": f"{base_id}-{i}"}):
        i += 1
    return f"{base_id}-{i}"


def add_character(name: str, description: str, persona_prompt: str,
                   era: str = "", title: str = "",
                   voice_id: Optional[str] = None,
                   avatar_emoji: str = "\U0001f9d1\u200d\U0001f393") -> Character:
    new_id = _unique_id(_slugify(name))

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
    characters_collection.insert_one(new_character.model_dump())
    return new_character
