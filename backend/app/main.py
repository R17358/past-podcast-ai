from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import auth, characters, chat, voice, languages, vision, uploads, quizzes, subscription

app = FastAPI(
    title="Character AI — Talk to History",
    description="Chat, speak, and show things to historical & mythological figures.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(auth.router)
app.include_router(characters.router)
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(vision.router)
app.include_router(languages.router)
app.include_router(uploads.router)
app.include_router(quizzes.router)
app.include_router(subscription.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "character-ai-backend"}
