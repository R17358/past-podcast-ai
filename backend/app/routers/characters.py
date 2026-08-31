from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import users_collection
from app.models.schemas import AddCharacterRequest, CharacterOut, UpdateCharacterRequest
from app.services import auth_service, character_store, llm_service

router = APIRouter(prefix="/api/characters", tags=["characters"])


@router.get("", response_model=list[CharacterOut])
def get_characters(
    search: Optional[str] = None,
    category: Optional[str] = None,
    user: Optional[dict] = Depends(auth_service.get_optional_user),
):
    characters = character_store.list_characters(search=search, category=category)
    return [character_store.to_character_out(c, user) for c in characters]


@router.get("/meta/categories", response_model=list[str])
def get_categories():
    """Distinct categories currently in use — powers the category filter
    dropdown/chips on the frontend."""
    return character_store.list_categories()


@router.get("/{character_id}", response_model=CharacterOut)
def get_character(character_id: str, user: Optional[dict] = Depends(auth_service.get_optional_user)):
    character = character_store.get_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character_store.to_character_out(character, user)


@router.post("", response_model=CharacterOut)
def add_character(payload: AddCharacterRequest, admin: dict = Depends(auth_service.require_admin)):
    """
    Admin-only. Supplies a name + short description; we ask Gemini to expand
    that into a full persona system prompt, then save the new character
    along with its category / access rules.
    """
    try:
        persona_prompt = llm_service.generate_persona_prompt(payload.name, payload.description)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate persona: {exc}")

    new_character = character_store.add_character(
        name=payload.name,
        description=payload.description,
        persona_prompt=persona_prompt,
        era=payload.era or "",
        title=payload.title or "",
        voice_id=payload.voice_id,
        avatar_emoji=payload.avatar_emoji or "🧑\u200d🎓",
        avatar_url=payload.avatar_url,
        category=payload.category or "General",
        access_type=payload.access_type or "free",
        unlock_points=payload.unlock_points or 0,
    )
    return character_store.to_character_out(new_character, admin)


@router.patch("/{character_id}", response_model=CharacterOut)
def edit_character(character_id: str, payload: UpdateCharacterRequest, admin: dict = Depends(auth_service.require_admin)):
    """Admin-only. Edits an existing character's profile — name, title, era,
    description, voice, avatar, category, and unlock rules."""
    if not character_store.get_character(character_id):
        raise HTTPException(status_code=404, detail="Character not found")
    updated = character_store.update_character(character_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Character not found")
    return character_store.to_character_out(updated, admin)


@router.post("/{character_id}/unlock", response_model=CharacterOut)
def unlock_character(character_id: str, user: dict = Depends(auth_service.get_current_user)):
    """Spends points to unlock a "points"-gated character. Free characters
    don't need this, and "subscription"-gated ones unlock automatically
    once a subscription is active (see /api/subscription)."""
    character = character_store.get_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    if character.access_type != "points":
        raise HTTPException(status_code=400, detail="This character can't be unlocked with points")
    if character_store.character_unlocked_for(character, user):
        return character_store.to_character_out(character, user)  # already unlocked — no-op

    user_points = user.get("points", 0)
    if user_points < character.unlock_points:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough points — need {character.unlock_points}, you have {user_points}.",
        )

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$inc": {"points": -character.unlock_points}, "$addToSet": {"unlocked_character_ids": character.id}},
    )
    user["points"] = user_points - character.unlock_points
    user["unlocked_character_ids"] = list(set((user.get("unlocked_character_ids") or []) + [character.id]))
    return character_store.to_character_out(character, user)
