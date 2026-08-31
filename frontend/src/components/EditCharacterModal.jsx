import { useState } from "react";
import { editCharacter } from "../services/api.js";
import ImageUploadField from "./ImageUploadField.jsx";

export default function EditCharacterModal({ character, onClose, onUpdated }) {
  const [name, setName] = useState(character.name || "");
  const [title, setTitle] = useState(character.title || "");
  const [era, setEra] = useState(character.era || "");
  const [description, setDescription] = useState(character.description || "");
  const [voiceId, setVoiceId] = useState(character.voice_id || "");
  const [avatarUrl, setAvatarUrl] = useState(character.avatar_url || "");
  const [emoji, setEmoji] = useState(character.avatar_emoji || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setLoading(true);
    setError("");
    try {
      const updated = await editCharacter(character.id, {
        name: name.trim(),
        title: title.trim(),
        era: era.trim(),
        description: description.trim(),
        voice_id: voiceId.trim() || null,
        avatar_emoji: emoji || null,
        avatar_url: avatarUrl || null,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save this character — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit {character.name}</h3>
        <p className="hint">Update this sage's profile, voice, and photo.</p>
        <form onSubmit={handleSubmit}>
          <ImageUploadField label="Photo" url={avatarUrl} emoji={emoji} onChange={setAvatarUrl} />
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Father of Physics" />
          </div>
          <div className="field">
            <label>Era</label>
            <input value={era} onChange={(e) => setEra(e.target.value)} placeholder="e.g. 1643 – 1727" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Fallback icon (emoji, used if no photo)</label>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🧪" />
          </div>
          <div className="field">
            <label>ElevenLabs voice ID (optional)</label>
            <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="Leave blank to use the default voice" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={loading || !name.trim() || !description.trim()}>
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
