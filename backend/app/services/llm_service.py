"""
All LLM logic (chatting in-character, auto-writing personas, rolling-summary
memory, and vision replies for the on-demand camera feature) lives here,
built on LangChain's Gemini integration.

Conversation state itself (raw messages + summary) is no longer kept here —
it's persisted in MongoDB via services/memory_service.py, so it survives
restarts and can follow a logged-in user across devices. This module is
purely "given some context, produce the next reply."
"""
import base64
from typing import List

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.config import settings
from app.models.schemas import ChatMessage
from app.data.languages import get_language

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


def _language_instruction(language: str) -> str:
    lang = get_language(language)
    return (
        f"\nAlways reply in {lang.label} (language code '{lang.code}'), regardless of the "
        "language the persona was originally written in. Keep the character's personality "
        "and tone, just express it in that language, using natural, native-sounding phrasing."
    )


def chat_with_character(persona_prompt: str, summary: str, history: List[ChatMessage],
                         user_message: str, language: str = "en") -> str:
    system_content = persona_prompt + "\n" + LIVE_CHARACTER_GUIDELINES + _language_instruction(language)
    if summary:
        system_content += (
            "\n\nHere is a summary of the earlier part of this same conversation "
            f"(for continuity — don't repeat it back verbatim): {summary}"
        )

    lc_messages = [SystemMessage(content=system_content)]
    for turn in history:
        if turn.role == "user":
            lc_messages.append(HumanMessage(content=turn.content))
        else:
            lc_messages.append(AIMessage(content=turn.content))
    lc_messages.append(HumanMessage(content=user_message))

    llm = _get_llm()
    response = llm.invoke(lc_messages)
    return response.content


def summarize_messages(persona_name: str, previous_summary: str, messages_to_fold: List[ChatMessage]) -> str:
    """
    Cost-control step: instead of sending the whole growing conversation to
    the LLM forever, older turns get condensed into one short rolling
    summary. Called only occasionally (see memory_service.save_turn), not on
    every message.
    """
    transcript = "\n".join(f"{m.role}: {m.content}" for m in messages_to_fold)
    instruction = (
        f"You are maintaining a short rolling memory summary of a conversation "
        f"between a user and {persona_name}. "
        f"Existing summary so far: {previous_summary or '(none yet)'}\n\n"
        f"New messages to fold in:\n{transcript}\n\n"
        "Write an updated summary in 4-6 sentences, covering the important facts, "
        "names, and context the user shared, plus anything the character promised or "
        "committed to. Be concise. Return ONLY the updated summary, nothing else."
    )
    llm = _get_llm(temperature=0.2)
    response = llm.invoke([HumanMessage(content=instruction)])
    return response.content.strip()


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


def ask_with_image(persona_prompt: str, image_base64: str, question: str, language: str = "en") -> str:
    """
    On-demand vision reply (the camera "Show" feature) — NOT continuous
    observation. Called once per button press, with a single captured frame.
    """
    if "," in image_base64 and image_base64.strip().startswith("data:"):
        image_base64 = image_base64.split(",", 1)[1]  # strip any "data:image/...;base64," prefix
    try:
        base64.b64decode(image_base64, validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid image data: {exc}")

    system_content = (
        persona_prompt + "\n" + LIVE_CHARACTER_GUIDELINES + _language_instruction(language)
        + "\nThe user has just shown you something through their camera. React to it in character, "
        "as if you were really looking at it right now."
    )
    message = HumanMessage(content=[
        {"type": "text", "text": question or "What do you see in this image?"},
        {"type": "image_url", "image_url": f"data:image/jpeg;base64,{image_base64}"},
    ])
    llm = _get_llm()
    response = llm.invoke([SystemMessage(content=system_content), message])
    return response.content
