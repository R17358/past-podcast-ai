import { Coins, Crown, Lock, Pencil } from "lucide-react";
import Avatar from "./Avatar.jsx";

export default function CharacterCard({ character, active, onSelect, onEdit, onUnlockClick }) {
  const isLocked = !character.unlocked;

  function handleClick() {
    if (isLocked) {
      onUnlockClick?.(character);
    } else {
      onSelect(character);
    }
  }

  return (
    <div className={`medallion-card-wrap ${active ? "active" : ""}`}>
      <button
        className={`medallion-card ${active ? "active" : ""} ${isLocked ? "locked" : ""}`}
        onClick={handleClick}
        title={isLocked
          ? character.access_type === "points"
            ? `Unlock for ${character.unlock_points} points`
            : "Requires a subscription"
          : character.description}
      >
        <span className="medallion-avatar-wrap">
          <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={52} className="medallion" />
          {isLocked && (
            <span className={`medallion-lock-badge ${character.access_type}`}>
              {character.access_type === "subscription" ? (
                <Crown size={11} strokeWidth={2.25} />
              ) : (
                <Lock size={11} strokeWidth={2.25} />
              )}
            </span>
          )}
        </span>
        <p className="medallion-name">{character.name}</p>
        {character.category && <span className="medallion-category">{character.category}</span>}
        {isLocked ? (
          <p className="medallion-title medallion-unlock-hint">
            {character.access_type === "points" ? (
              <><Coins size={11} strokeWidth={2} /> {character.unlock_points} pts</>
            ) : (
              <><Crown size={11} strokeWidth={2} /> Subscription</>
            )}
          </p>
        ) : (
          <p className="medallion-title">{character.title}</p>
        )}
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
