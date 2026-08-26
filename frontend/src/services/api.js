import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_BASE });

export async function fetchCharacters() {
  const { data } = await api.get("/api/characters");
  return data;
}

export async function fetchLanguages() {
  const { data } = await api.get("/api/languages");
  return data;
}

export async function addCharacter(payload) {
  const { data } = await api.post("/api/characters", payload);
  return data;
}

export async function sendMessage({ characterId, sessionId, message, language }) {
  const { data } = await api.post("/api/chat", {
    character_id: characterId,
    session_id: sessionId,
    message,
    language: language || "en",
  });
  return data;
}

export async function resetChat({ characterId, sessionId }) {
  await api.post("/api/chat/reset", null, {
    params: { character_id: characterId, session_id: sessionId },
  });
}

export async function fetchVoice({ characterId, text, language }) {
  const response = await api.post(
    "/api/voice",
    { character_id: characterId, text, language: language || "en" },
    { responseType: "blob" }
  );
  return URL.createObjectURL(response.data);
}
