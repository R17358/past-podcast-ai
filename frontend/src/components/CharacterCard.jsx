export default function CharacterCard({ character, active, onSelect }) {
  const isLocked = character.locked;

  return (
    <button
      className={`medallion-card ${active ? "active" : ""} ${isLocked ? "locked" : ""}`}
      onClick={() => !isLocked && onSelect(character)}
      disabled={isLocked}
      title={isLocked ? character.unlock_hint || "Locked" : character.description}
    >
      <div className="medallion">{isLocked ? "🔒" : character.avatar_emoji}</div>
      <p className="medallion-name">{character.name}</p>
      <p className="medallion-title">{isLocked ? (character.unlock_hint || "Locked") : character.title}</p>
    </button>
  );
}
