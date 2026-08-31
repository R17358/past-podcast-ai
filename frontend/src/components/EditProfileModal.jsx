import { useState } from "react";
import { updateProfile } from "../services/api.js";
import ImageUploadField from "./ImageUploadField.jsx";

export default function EditProfileModal({ user, onClose, onUpdated }) {
  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const updated = await updateProfile({ name: name.trim(), avatar_url: avatarUrl || null });
      onUpdated(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save your profile — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit profile</h3>
        <p className="hint">Update your display name and profile photo.</p>
        <form onSubmit={handleSubmit}>
          <ImageUploadField label="Profile photo" url={avatarUrl} emoji={null} onChange={setAvatarUrl} />
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={user?.email || ""} disabled />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={loading || !name.trim()}>
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
