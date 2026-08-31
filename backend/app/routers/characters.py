from fastapi import APIRouter, HTTPException

from app.models.schemas import Character, AddCharacterRequest, UpdateCharacterRequest
from app.services import character_store, llm_service

router = APIRouter(prefix="/api/characters", tags=["characters"])


@router.get("", response_model=list[Character])
def get_characters():
    return character_store.list_characters()


@router.get("/{character_id}", response_model=Character)
def get_character(character_id: str):
    character = character_store.get_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.post("", response_model=Character)
def add_character(payload: AddCharacterRequest):
    """
    User only supplies a name + short description; we ask Gemini to expand
    that into a full persona system prompt, then save the new character.
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
    )
    return new_character


@router.patch("/{character_id}", response_model=Character)
def edit_character(character_id: str, payload: UpdateCharacterRequest):
    """Edits an existing character's profile — name, title, era, description,
    voice, and avatar (emoji fallback or uploaded photo URL)."""
    if not character_store.get_character(character_id):
        raise HTTPException(status_code=404, detail="Character not found")
    updated = character_store.update_character(character_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Character not found")
    return updated
