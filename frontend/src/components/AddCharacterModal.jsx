import { useState } from "react";
import { addCharacter } from "../services/api.js";
import ImageUploadField from "./ImageUploadField.jsx";

const COMMON_CATEGORIES = ["Science", "Philosophy", "History", "Mythology", "Anime", "Literature", "Other"];

export default function AddCharacterModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [era, setEra] = useState("");
  const [emoji, setEmoji] = useState("🧑\u200d🎓");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [category, setCategory] = useState("General");
  const [accessType, setAccessType] = useState("free");
  const [unlockPoints, setUnlockPoints] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setLoading(true);
    setError("");
    try {
      const created = await addCharacter({
        name: name.trim(),
        description: description.trim(),
        era: era.trim(),
        avatar_emoji: emoji || "🧑\u200d🎓",
        avatar_url: avatarUrl || null,
        voice_id: voiceId.trim() || null,
        category: category.trim() || "General",
        access_type: accessType,
        unlock_points: accessType === "points" ? Number(unlockPoints) || 0 : 0,
      });
      onCreated(created);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not summon this character. Check the backend / API keys and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Summon a new sage</h3>
        <p className="hint">
          Give a name and a short description — the persona, tone and voice will be written for you.
        </p>
        <form onSubmit={handleSubmit}>
          <ImageUploadField label="Photo (optional)" url={avatarUrl} emoji={emoji} onChange={setAvatarUrl} />
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marie Curie" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who were they, and what should they be known for in conversation?"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Era (optional)</label>
              <input value={era} onChange={(e) => setEra(e.target.value)} placeholder="e.g. 1867 – 1934" />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} list="category-suggestions" placeholder="e.g. Science" />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="field">
            <label>Access</label>
            <div className="access-type-radios">
              <label><input type="radio" checked={accessType === "free"} onChange={() => setAccessType("free")} /> Free</label>
              <label><input type="radio" checked={accessType === "points"} onChange={() => setAccessType("points")} /> Points</label>
              <label><input type="radio" checked={accessType === "subscription"} onChange={() => setAccessType("subscription")} /> Subscription</label>
            </div>
            {accessType === "points" && (
              <input
                type="number"
                min={1}
                value={unlockPoints}
                onChange={(e) => setUnlockPoints(e.target.value)}
                placeholder="Points required to unlock"
                style={{ marginTop: 8 }}
              />
            )}
          </div>

          <div className="field">
            <label>Fallback icon (emoji, used if no photo)</label>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🧪" />
          </div>
          <div className="field">
            <label>ElevenLabs voice ID (optional)</label>
            <input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="Leave blank to use the default voice"
            />
            <p className="hint">
              Give each character their own voice from your ElevenLabs account (must be a voice
              in "My Voices", not the shared Voice Library, on the free plan). Copy the ID from
              the voice's page in ElevenLabs.
            </p>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "Summoning…" : "Add to the Hall"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
