import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

export const LENGTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "normal", label: "Normal" },
  { value: "detailed", label: "Detailed" },
];

export const TONE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "friendly", label: "Friendly" },
];

const isNonDefault = (length, tone) => length !== "normal" || tone !== "normal";

// A small popover (opened from a header icon button) letting the user pick
// how THIS character replies — reply length and tone — per conversation.
// Purely a generation-time instruction sent with each /api/chat request
// (see llm_service._style_instruction on the backend); nothing is persisted
// server-side, the choice just lives in localStorage per character (see
// ChatWindow's use of styleStorageKey) so it's remembered next time you open
// the same character on this device.
export default function StyleSettingsButton({ length, tone, onChange }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="style-settings" ref={popoverRef}>
      <button
        className={`icon-btn ${isNonDefault(length, tone) ? "icon-btn-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Reply style"
        aria-label="Reply style settings"
      >
        <Sparkles size={16} strokeWidth={2} />
      </button>
      {open && (
        <div className="style-popover">
          <p className="style-popover-title">Reply style</p>
          <div className="style-field">
            <label>Length</label>
            <div className="style-chip-row">
              {LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`style-chip ${length === opt.value ? "active" : ""}`}
                  onClick={() => onChange({ length: opt.value, tone })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="style-field">
            <label>Tone</label>
            <div className="style-chip-row">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`style-chip ${tone === opt.value ? "active" : ""}`}
                  onClick={() => onChange({ length, tone: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
