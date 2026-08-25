from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import characters, chat, voice

app = FastAPI(
    title="Character AI — Talk to History",
    description="Chat and speak with historical & mythological figures.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(characters.router)
app.include_router(chat.router)
app.include_router(voice.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "character-ai-backend"}
