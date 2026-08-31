import { useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { uploadImage } from "../services/api.js";
import Avatar from "./Avatar.jsx";

// A "choose file" avatar uploader: shows the current photo (or a fallback
// emoji), and a button that opens the OS file picker, uploads straight to
// Cloudinary via the backend, and reports the resulting URL back up.
export default function ImageUploadField({ label, url, emoji, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again later
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const uploadedUrl = await uploadImage(file);
      onChange(uploadedUrl);
    } catch (err) {
      setError(err?.response?.data?.detail || "Upload failed — please try a different image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="image-upload-row">
        <Avatar url={url} emoji={emoji} size={64} />
        <button
          type="button"
          className="ghost-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={15} className="spin-icon" /> : <ImageUp size={15} />}
          {uploading ? "Uploading…" : url ? "Change photo" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFile}
          hidden
        />
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
