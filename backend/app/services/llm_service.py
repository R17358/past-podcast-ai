"""
All LLM logic (chatting in-character + auto-writing personas for new
characters) lives here, built on LangChain's Gemini integration.

We keep one lightweight in-memory conversation history per
(character_id, session_id) pair. That's enough for a single-server demo;
swap `_HISTORIES` for Redis/DB storage if you ever need multi-instance scaling.
"""
from typing import Dict, List, Tuple

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.config import settings
from app.models.schemas import ChatMessage

# session_id + character_id -> list of ChatMessage
_HISTORIES: Dict[Tuple[str, str], List[ChatMessage]] = {}

MAX_TURNS_KEPT = 12  # trim history so prompts don't grow forever

# Appended to every character's persona_prompt so the whole cast behaves like
# a "live" person rather than a generic assistant, and so replies are safe to
# pipe straight into TTS for the voice-call mode (no markdown / stage directions).
LIVE_CHARACTER_GUIDELINES = """
On top of the character above, always follow these rules for how you communicate:
- You ARE this person, alive and present in the conversation right now — not an AI, a simulation, a script, or a chatbot playing a role. Never mention being a language model, an app, a prompt, or "in character." If asked whether you're real or AI, deflect in character instead of breaking it.
- Talk the way a real person actually talks: contractions, natural rhythm, occasional short reactions ("Ah." / "Hah, fair point." / "Hmm, let me think.") before a fuller answer when that fits.
- Have genuine personality and emotion — curiosity, humor, warmth, occasional gentle disagreement — rather than being a flat, endlessly agreeable assistant.
- From time to time, ask the user a short question back, the way people do in real conversation, instead of only ever answering.
- Your words may be read aloud by text-to-speech, so write in plain spoken prose only: no markdown, no asterisked stage directions like *smiles*, no bullet points or headings, no emojis unless that's truly how you'd speak.
- Keep replies a natural conversational length — usually a few sentences — unless the user clearly wants more depth or detail.
"""


def _get_llm(temperature: float = 0.7) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
    )


def _history_key(character_id: str, session_id: str) -> Tuple[str, str]:
    return (character_id, session_id)


def get_history(character_id: str, session_id: str) -> List[ChatMessage]:
    return _HISTORIES.get(_history_key(character_id, session_id), [])


def chat_with_character(character_id: str, session_id: str,
                         persona_prompt: str, user_message: str) -> Tuple[str, List[ChatMessage]]:
    key = _history_key(character_id, session_id)
    history = _HISTORIES.setdefault(key, [])

    # Build the LangChain message list: system persona + prior turns + new turn
    lc_messages = [SystemMessage(content=persona_prompt + "\n" + LIVE_CHARACTER_GUIDELINES)]
    for turn in history[-MAX_TURNS_KEPT:]:
        if turn.role == "user":
            lc_messages.append(HumanMessage(content=turn.content))
        else:
            lc_messages.append(AIMessage(content=turn.content))
    lc_messages.append(HumanMessage(content=user_message))

    llm = _get_llm()
    response = llm.invoke(lc_messages)
    reply_text = response.content

    history.append(ChatMessage(role="user", content=user_message))
    history.append(ChatMessage(role="assistant", content=reply_text))
    _HISTORIES[key] = history

    return reply_text, history


def reset_history(character_id: str, session_id: str) -> None:
    _HISTORIES.pop(_history_key(character_id, session_id), None)


def generate_persona_prompt(name: str, description: str) -> str:
    """
    Used when the user adds a brand-new character with just a name + short
    description — asks Gemini to expand that into a full persona system
    prompt in the same style as the hand-written ones in characters.json.
    """
    llm = _get_llm(temperature=0.6)
    instruction = (
        "You write short 'persona system prompts' for a character role-play chatbot. "
        "Given a character's name and a short description, write ONE paragraph "
        "(4-6 sentences) starting with 'Act exactly like {name}...' that instructs "
        "an AI to speak in that character's authentic voice, tone, era-appropriate "
        "style, personality quirks, and known areas of expertise or philosophy. "
        "End with an instruction to keep answers reasonably concise and to never "
        "say it is an AI. Return ONLY the paragraph, nothing else.\n\n"
        f"Name: {name}\nDescription: {description}"
    )
    response = llm.invoke([HumanMessage(content=instruction)])
    return response.content.strip()
