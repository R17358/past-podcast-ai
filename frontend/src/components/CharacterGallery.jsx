import CharacterCard from "./CharacterCard.jsx";
import LanguageSelector from "./LanguageSelector.jsx";

export default function CharacterGallery({
  characters,
  activeId,
  onSelect,
  onAddClick,
  language,
  onLanguageChange,
}) {
  return (
    <aside className="hall">
      <div className="hall-head">
        <p className="hall-eyebrow">Hall of Sages</p>
        <h1 className="hall-title">
          Talk to <em>History</em>
        </h1>
        <LanguageSelector value={language} onChange={onLanguageChange} />
      </div>

      <div className="character-grid">
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            active={c.id === activeId}
            onSelect={onSelect}
          />
        ))}
        <button className="add-character-tile" onClick={onAddClick}>
          <span className="add-plus">+</span>
          <span>Summon a new sage</span>
        </button>
      </div>
    </aside>
  );
}
