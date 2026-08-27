import { useState } from "react";
import { fetchVoice, playVoice } from "../services/api.js";

export default function MessageBubble({ role, content, character, language = "en" }) {
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");

  const isUser = role === "user";

  async function handleListen() {
    setError("");
    if (audioUrl) {
      playVoice(audioUrl).catch(() => setError("Playback blocked by browser."));
      return;
    }
    setLoadingAudio(true);
    try {
      const url = await fetchVoice({ characterId: character.id, text: content, language });
      setAudioUrl(url);
      await playVoice(url);
    } catch (err) {
      console.error("Voice generation failed", err);
      setError("Voice unavailable right now.");
    } finally {
      setLoadingAudio(false);
    }
  }

  return (
    <div className={`bubble-row ${isUser ? "user" : "character"}`}>
      {!isUser && <div className="bubble-mini-avatar">{character.avatar_emoji}</div>}
      <div className="bubble-col">
        <div className="bubble">{content}</div>
        {!isUser && (
          <div className="bubble-meta">
            <button className="listen-btn" onClick={handleListen} disabled={loadingAudio}>
              {loadingAudio ? "Conjuring voice…" : "🔊 Listen"}
            </button>
            {error && <span className="bubble-error">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
