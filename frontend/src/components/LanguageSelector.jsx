import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { fetchLanguages } from "../services/api.js";

export const FALLBACK_LANGUAGES = [
  { code: "en", label: "English", speech_locale: "en-US" },
  { code: "hi", label: "हिंदी (Hindi)", speech_locale: "hi-IN" },
  { code: "mr", label: "मराठी (Marathi)", speech_locale: "mr-IN" },
];

export default function LanguageSelector({ value, onChange, compact = false }) {
  const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);

  useEffect(() => {
    fetchLanguages()
      .then((data) => data?.length && setLanguages(data))
      .catch(() => {
        /* keep fallback list — not fatal */
      });
  }, []);

  return (
    <label className={`lang-select ${compact ? "compact" : ""}`} title="Conversation language">
      <span className="lang-select-icon"><Globe size={14} strokeWidth={2} /></span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Language">
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
