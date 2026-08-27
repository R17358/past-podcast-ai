"""
Conversation memory, persisted in MongoDB instead of the old in-process dict
(which was lost on every restart/redeploy and couldn't follow a user across
devices).

Cost-control strategy: we don't send the whole conversation to the LLM on
every turn. We keep the last MEMORY_MAX_RAW_MESSAGES messages in full, and
fold everything older into a single rolling text `summary` (one extra LLM
call, only when the raw buffer gets too long — not on every message). Token
usage per request stays roughly flat no matter how long the conversation runs.

`owner_key` scopes memory to whoever is talking:
- a logged-in user  -> their Mongo user id, so it follows them across devices
- a guest           -> "guest:<session_id>", so it still works with no login,
                       scoped to that one browser tab/session
"""
from typing import List, Tuple

from app.config import settings
from app.db import conversations_collection
from app.models.schemas import ChatMessage


def _doc_key(owner_key: str, character_id: str) -> dict:
    return {"owner_key": owner_key, "character_id": character_id}


def get_context(owner_key: str, character_id: str) -> Tuple[str, List[ChatMessage]]:
    """Returns (summary_of_older_turns, recent_raw_messages)."""
    doc = conversations_collection.find_one(_doc_key(owner_key, character_id))
    if not doc:
        return "", []
    history = [ChatMessage(**m) for m in doc.get("messages", [])]
    return doc.get("summary", ""), history


def save_turn(owner_key: str, character_id: str, persona_name: str,
              user_message: str, assistant_message: str) -> List[ChatMessage]:
    """Appends the new turn, and — only when the raw buffer has grown past the
    threshold — folds the oldest half into the rolling summary. Returns the
    full recent history (for the API response)."""
    summary, history = get_context(owner_key, character_id)
    history.append(ChatMessage(role="user", content=user_message))
    history.append(ChatMessage(role="assistant", content=assistant_message))

    if len(history) > settings.MEMORY_MAX_RAW_MESSAGES:
        split = len(history) - settings.MEMORY_MAX_RAW_MESSAGES
        to_fold, history = history[:split], history[split:]
        from app.services.llm_service import summarize_messages  # avoid circular import
        summary = summarize_messages(persona_name, summary, to_fold)

    conversations_collection.update_one(
        _doc_key(owner_key, character_id),
        {"$set": {
            "summary": summary,
            "messages": [m.model_dump() for m in history],
        }},
        upsert=True,
    )
    return history


def reset(owner_key: str, character_id: str) -> None:
    conversations_collection.delete_one(_doc_key(owner_key, character_id))
