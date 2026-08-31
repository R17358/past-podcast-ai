import { Lock, Pencil } from "lucide-react";
import Avatar from "./Avatar.jsx";

export default function CharacterCard({ character, active, onSelect, onEdit }) {
  const isLocked = character.locked;

  return (
    <div className={`medallion-card-wrap ${active ? "active" : ""}`}>
      <button
        className={`medallion-card ${active ? "active" : ""} ${isLocked ? "locked" : ""}`}
        onClick={() => !isLocked && onSelect(character)}
        disabled={isLocked}
        title={isLocked ? character.unlock_hint || "Locked" : character.description}
      >
        {isLocked ? (
          <span className="medallion medallion-locked">
            <Lock size={20} strokeWidth={1.75} />
          </span>
        ) : (
          <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={52} className="medallion" />
        )}
        <p className="medallion-name">{character.name}</p>
        <p className="medallion-title">{isLocked ? (character.unlock_hint || "Locked") : character.title}</p>
      </button>
      {!isLocked && onEdit && (
        <button
          className="medallion-edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(character);
          }}
          title={`Edit ${character.name}`}
          aria-label={`Edit ${character.name}`}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
