from fastapi import APIRouter, HTTPException

from app.models.schemas import ChatRequest, ChatResponse
from app.services import character_store, llm_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def send_message(payload: ChatRequest):
    character = character_store.get_character(payload.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    try:
        reply, history = llm_service.chat_with_character(
            character_id=character.id,
            session_id=payload.session_id,
            persona_prompt=character.persona_prompt,
            user_message=payload.message,
            language=payload.language or "en",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")

    return ChatResponse(character_id=character.id, reply=reply, history=history)


@router.post("/reset")
def reset_chat(character_id: str, session_id: str):
    llm_service.reset_history(character_id, session_id)
    return {"status": "cleared"}
