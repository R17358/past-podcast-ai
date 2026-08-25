import { useState } from "react";
import { addCharacter } from "../services/api.js";

export default function AddCharacterModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [era, setEra] = useState("");
  const [emoji, setEmoji] = useState("🧑\u200d🎓");
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
      });
      onCreated(created);
    } catch (err) {
      setError("Could not summon this character. Check the backend / API keys and try again.");
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
          <div className="field">
            <label>Era (optional)</label>
            <input value={era} onChange={(e) => setEra(e.target.value)} placeholder="e.g. 1867 – 1934" />
          </div>
          <div className="field">
            <label>Avatar emoji (optional)</label>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🧪" />
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
