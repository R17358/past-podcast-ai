from fastapi import APIRouter, HTTPException

from app.models.schemas import VisionRequest, VisionResponse
from app.services import character_store, llm_service

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("", response_model=VisionResponse)
def see_image(payload: VisionRequest):
    """
    Called only when the user taps the camera/"Show" button and captures a
    single frame — the AI is never continuously watching. Doesn't touch
    conversation memory directly; the frontend adds the exchange to the chat
    like a normal message so it reads naturally in the transcript.
    """
    character = character_store.get_character(payload.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    try:
        reply = llm_service.ask_with_image(
            persona_prompt=character.persona_prompt,
            image_base64=payload.image_base64,
            question=payload.question or "What do you see in this image?",
            language=payload.language or "en",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vision error: {exc}")

    return VisionResponse(character_id=character.id, reply=reply)
