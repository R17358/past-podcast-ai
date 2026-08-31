import { LogOut, Pencil, Plus } from "lucide-react";
import CharacterCard from "./CharacterCard.jsx";
import LanguageSelector from "./LanguageSelector.jsx";
import Avatar from "./Avatar.jsx";

export default function CharacterGallery({
  characters,
  activeId,
  onSelect,
  onAddClick,
  onEditCharacter,
  language,
  onLanguageChange,
  user,
  onEditProfile,
  onLogout,
}) {
  return (
    <aside className="hall">
      <div className="hall-head">
        <p className="hall-eyebrow">Hall of Sages</p>
        <h1 className="hall-title">
          Talk to <em>History</em>
        </h1>
        <LanguageSelector value={language} onChange={onLanguageChange} />
        <div className="account-row">
          <button className="account-identity" onClick={onEditProfile} title="Edit profile">
            <Avatar url={user?.avatar_url} emoji={null} size={28} />
            <span className="account-name">{user?.name}</span>
            <Pencil size={12} className="account-edit-icon" strokeWidth={2} />
          </button>
          <button className="icon-btn" onClick={onLogout} title="Log out" aria-label="Log out">
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="character-grid">
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            active={c.id === activeId}
            onSelect={onSelect}
            onEdit={onEditCharacter}
          />
        ))}
        <button className="add-character-tile" onClick={onAddClick}>
          <span className="add-plus"><Plus size={22} strokeWidth={2} /></span>
          <span>Summon a new sage</span>
        </button>
      </div>
    </aside>
  );
}
