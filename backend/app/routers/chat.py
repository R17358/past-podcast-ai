from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import ChatRequest, ChatResponse
from app.services import character_store, llm_service, memory_service
from app.services.auth_service import get_optional_user_id

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _owner_key(user_id: Optional[str], session_id: str) -> str:
    # Logged-in users get memory that follows them across devices; guests get
    # memory scoped to just their browser session — both persist in Mongo
    # either way, so a page refresh never loses the conversation.
    return user_id if user_id else f"guest:{session_id}"


@router.post("", response_model=ChatResponse)
def send_message(payload: ChatRequest, user_id: Optional[str] = Depends(get_optional_user_id)):
    character = character_store.get_character(payload.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    owner_key = _owner_key(user_id, payload.session_id)
    summary, history = memory_service.get_context(owner_key, character.id)

    try:
        reply = llm_service.chat_with_character(
            persona_prompt=character.persona_prompt,
            summary=summary,
            history=history,
            user_message=payload.message,
            language=payload.language or "en",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")

    updated_history = memory_service.save_turn(
        owner_key, character.id, character.name, payload.message, reply
    )
    return ChatResponse(character_id=character.id, reply=reply, history=updated_history)


@router.post("/reset")
def reset_chat(character_id: str, session_id: str, user_id: Optional[str] = Depends(get_optional_user_id)):
    memory_service.reset(_owner_key(user_id, session_id), character_id)
    return {"status": "cleared"}
