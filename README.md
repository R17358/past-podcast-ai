# Hall of Sages — Character AI

Chat (and hear) historical & mythological figures, powered by Gemini (via LangChain)
for conversation and ElevenLabs for voice.

```
character-ai-app/
├── backend/          FastAPI + LangChain + Gemini
│   └── app/
│       ├── main.py            entrypoint
│       ├── config.py          env vars
│       ├── models/schemas.py  request/response shapes
│       ├── services/          character_store, llm_service, tts_service
│       ├── routers/           characters, chat, voice
│       └── data/characters.json   default characters (Newton, Chanakya, Krishna)
└── frontend/         React (Vite)
    └── src/
        ├── App.jsx
        ├── components/  CharacterGallery, CharacterCard, ChatWindow, MessageBubble, AddCharacterModal
        ├── services/api.js
        └── styles/      theme.css, App.css
```

## 1. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your GEMINI_API_KEY and ELEVEN_LAB_API key
uvicorn app.main:app --reload --port 8000
```

Backend will run at `http://localhost:8000`. Visit `http://localhost:8000/docs`
for the interactive API docs.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL should point at your backend (default http://localhost:8000)
npm run dev
```

Frontend will run at `http://localhost:5173`.

## How it works

- **Chat**: each message goes to `POST /api/chat` with a `character_id` and a
  `session_id` (one random id generated per browser tab). The backend keeps a
  short in-memory conversation history per (character, session) pair and feeds
  it to Gemini through LangChain, along with that character's `persona_prompt`
  as a system message — this is what keeps the model "in character".
- **Voice**: nothing is spoken automatically. Every character reply has a
  "🔊 Listen" button; only when tapped does the frontend call `POST /api/voice`,
  which runs ElevenLabs TTS and streams back mp3 bytes. This keeps ElevenLabs
  usage (and cost) opt-in.
- **Adding a character**: the "Summon a new sage" tile opens a small form
  (name + short description + optional era/emoji). The backend sends that to
  Gemini once to auto-write a full persona system prompt in the same style as
  the hand-written ones, then saves the character into `data/characters.json`
  — no restart needed, it shows up in the Hall immediately.
- **Unlockable characters**: `Character.locked` + `unlock_hint` fields already
  exist in the schema/UI (greyed-out medallion with a lock icon and a hint
  instead of the title). To wire up real unlocking later — e.g. after N
  conversations, or a quiz, or an invite code — flip `locked` to `false` for
  that character's entry in `characters.json` (or add an endpoint that does it).

## Notes / things to adapt before going to production

- Conversation history is kept **in memory** in the backend process — fine for
  local use or a single demo instance, but it resets on server restart and
  won't work across multiple server instances. Swap `_HISTORIES` in
  `llm_service.py` for Redis or a database table if you deploy this for real.
- `ALLOWED_ORIGINS` in the backend `.env` must include whatever URL your
  deployed frontend runs on (Vercel URL, etc.) or the browser will block
  requests with a CORS error.
- Your two original scripts (Gemini persona chat, ElevenLabs TTS + local
  playback) are now `llm_service.py` and `tts_service.py` respectively —
  restructured to return values instead of printing/playing directly, so the
  API can serve them to any number of users instead of just your machine.
