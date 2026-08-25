import { useState } from "react";
import { fetchVoice } from "../services/api.js";

export default function MessageBubble({ role, content, character }) {
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const isUser = role === "user";

  async function handleListen() {
    if (audioUrl) {
      new Audio(audioUrl).play();
      return;
    }
    setLoadingAudio(true);
    try {
      const url = await fetchVoice({ characterId: character.id, text: content });
      setAudioUrl(url);
      new Audio(url).play();
    } catch (err) {
      console.error("Voice generation failed", err);
    } finally {
      setLoadingAudio(false);
    }
  }

  return (
    <div className={`bubble-row ${isUser ? "user" : "character"}`}>
      {!isUser && <div className="bubble-mini-avatar">{character.avatar_emoji}</div>}
      <div>
        <div className="bubble">{content}</div>
        {!isUser && (
          <button className="listen-btn" onClick={handleListen} disabled={loadingAudio}>
            {loadingAudio ? "Conjuring voice…" : "🔊 Listen"}
          </button>
        )}
      </div>
    </div>
  );
}
