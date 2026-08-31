import { UserRound } from "lucide-react";

// Single place that decides how any avatar (character or user) renders:
// an uploaded photo (Cloudinary URL) takes priority, falling back to an
// emoji, falling back to a plain icon. Used everywhere an avatar shows up
// so a photo added in one place (e.g. edit character) appears consistently
// everywhere else (gallery tile, chat header, call orb, message bubbles).
export default function Avatar({ url, emoji, alt = "", size = 40, className = "" }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.46) };

  if (url) {
    return (
      <span className={`avatar-photo ${className}`} style={style}>
        <img src={url} alt={alt} />
      </span>
    );
  }
  if (emoji) {
    return (
      <span className={`avatar-emoji ${className}`} style={style}>
        {emoji}
      </span>
    );
  }
  return (
    <span className={`avatar-emoji avatar-fallback ${className}`} style={style}>
      <UserRound size={Math.round(size * 0.55)} strokeWidth={1.75} />
    </span>
  );
}
