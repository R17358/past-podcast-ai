import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "hos-token";

const api = axios.create({ baseURL: API_BASE });

// Attach the logged-in user's JWT (if any) to every request automatically.
// Guests simply send no Authorization header, which every backend route
// treats as valid (falls back to session-scoped memory).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Shared "only one voice plays at a time" state ---
// Every part of the app (live-call mode, Listen buttons) routes through
// stopCurrentVoice()/playVoice() so a new voice request always kills the old one.
let currentAudioEl = null;
let currentController = null;

export function stopCurrentVoice() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
  if (currentAudioEl) {
    currentAudioEl.pause();
    currentAudioEl.currentTime = 0;
    currentAudioEl = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel(); // stop browser-voice fallback too
}

// --- Auth ---

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

function _saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  return data;
}

export async function signup({ name, email, password }) {
  const { data } = await api.post("/api/auth/signup", { name, email, password });
  return _saveSession(data);
}

export async function login({ email, password }) {
  const { data } = await api.post("/api/auth/login", { email, password });
  return _saveSession(data);
}

export async function fetchMe() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function googleLogin({ idToken }) {
  const { data } = await api.post("/api/auth/google", { id_token: idToken });
  return _saveSession(data);
}

export async function updateProfile(payload) {
  const { data } = await api.patch("/api/auth/me", payload);
  return data;
}

// --- Uploads (Cloudinary-backed avatar photos) ---

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/uploads/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

// --- Characters ---

export async function fetchCharacters({ search, category } = {}) {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (category && category !== "All") params.category = category;
  const { data } = await api.get("/api/characters", { params });
  return data;
}

export async function fetchCategories() {
  const { data } = await api.get("/api/characters/meta/categories");
  return data;
}

export async function addCharacter(payload) {
  const { data } = await api.post("/api/characters", payload);
  return data;
}

export async function editCharacter(characterId, payload) {
  const { data } = await api.patch(`/api/characters/${characterId}`, payload);
  return data;
}

export async function unlockCharacter(characterId) {
  const { data } = await api.post(`/api/characters/${characterId}/unlock`);
  return data;
}

// --- Quizzes (gamification) ---

export async function fetchQuizzes({ characterId, category } = {}) {
  const params = {};
  if (characterId) params.character_id = characterId;
  if (category) params.category = category;
  const { data } = await api.get("/api/quizzes", { params });
  return data;
}

export async function fetchQuiz(quizId) {
  const { data } = await api.get(`/api/quizzes/${quizId}`);
  return data;
}

export async function submitQuiz(quizId, answers) {
  const { data } = await api.post(`/api/quizzes/${quizId}/submit`, { answers });
  return data;
}

export async function fetchAllQuizzesAdmin() {
  const { data } = await api.get("/api/quizzes/admin/all");
  return data;
}

export async function createQuiz(payload) {
  const { data } = await api.post("/api/quizzes", payload);
  return data;
}

export async function generateQuiz(payload) {
  const { data } = await api.post("/api/quizzes/generate", payload);
  return data;
}

export async function editQuiz(quizId, payload) {
  const { data } = await api.patch(`/api/quizzes/${quizId}`, payload);
  return data;
}

export async function deleteQuiz(quizId) {
  await api.delete(`/api/quizzes/${quizId}`);
}

// --- Subscription (Razorpay) ---

export async function fetchSubscriptionStatus() {
  const { data } = await api.get("/api/subscription/status");
  return data;
}

export async function createSubscriptionOrder() {
  const { data } = await api.post("/api/subscription/create-order");
  return data;
}

export async function verifySubscriptionPayment(payload) {
  const { data } = await api.post("/api/subscription/verify", payload);
  return data;
}

// Loads Razorpay's checkout.js once and resolves true/false — used right
// before opening the checkout widget so we don't add a <script> tag for
// people who never touch the subscription flow.
export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.getElementById("razorpay-checkout-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// --- Languages ---

export async function fetchLanguages() {
  const { data } = await api.get("/api/languages");
  return data;
}

// --- Chat ---

export async function sendMessage({ characterId, sessionId, message, language, responseLength, tone }) {
  const { data } = await api.post("/api/chat", {
    character_id: characterId,
    session_id: sessionId,
    message,
    language: language || "en",
    response_length: responseLength || "normal",
    tone: tone || "normal",
  });
  return data;
}

export async function resetChat({ characterId, sessionId }) {
  await api.post("/api/chat/reset", null, {
    params: { character_id: characterId, session_id: sessionId },
  });
}

// --- Voice ---

export async function fetchVoice({ characterId, text, language }) {
  stopCurrentVoice(); // a new voice request always cancels whatever was in flight/playing
  currentController = new AbortController();
  try {
    const response = await api.post(
      "/api/voice",
      { character_id: characterId, text, language: language || "en" },
      { responseType: "blob", signal: currentController.signal }
    );
    return URL.createObjectURL(response.data);
  } finally {
    currentController = null;
  }
}

// Plays a url through a given <audio> element (pass the persistent one from
// live-call mode) or creates a throwaway one for one-off "Listen" clicks.
export function playVoice(url, audioEl) {
  const audio = audioEl || new Audio();
  audio.src = url;
  currentAudioEl = audio;
  return audio.play();
}

// --- Vision (on-demand camera "Show" button) ---

export async function fetchVision({ characterId, sessionId, imageBase64, question, language }) {
  const { data } = await api.post("/api/vision", {
    character_id: characterId,
    session_id: sessionId,
    image_base64: imageBase64,
    question: question || "What do you see in this image?",
    language: language || "en",
  });
  return data;
}
