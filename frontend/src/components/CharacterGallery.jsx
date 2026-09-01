import { Coins, HelpCircle, ListChecks, LogOut, Pencil, Plus, Search, Settings2 } from "lucide-react";
import CharacterCard from "./CharacterCard.jsx";
import LanguageSelector from "./LanguageSelector.jsx";
import Avatar from "./Avatar.jsx";

export default function CharacterGallery({
  characters,
  activeId,
  onSelect,
  onAddClick,
  onEditCharacter,
  onUnlockClick,
  language,
  onLanguageChange,
  user,
  isAdmin,
  onEditProfile,
  onLogout,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  onOpenQuizzes,
  onOpenAdminQuizzes,
  onOpenTour,
}) {
  return (
    <aside className="hall">
      <div className="hall-head">
        <div className="hall-eyebrow-row">
          <p className="hall-eyebrow">Hall of Sages</p>
          <button className="icon-btn tour-help-btn" onClick={onOpenTour} title="Take the tour" aria-label="Take the tour">
            <HelpCircle size={15} strokeWidth={2} />
          </button>
        </div>
        <h1 className="hall-title">
          Talk to <em>History</em>
        </h1>
        <LanguageSelector value={language} onChange={onLanguageChange} />

        <div className="search-row">
          <span className="search-icon"><Search size={14} strokeWidth={2} /></span>
          <input
            className="search-input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or topic…"
          />
        </div>

        <div className="category-chips">
          <button
            className={`category-chip ${category === "All" ? "active" : ""}`}
            onClick={() => onCategoryChange("All")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`category-chip ${category === c ? "active" : ""}`}
              onClick={() => onCategoryChange(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="gamify-row">
          <button className="ghost-btn gamify-btn" onClick={onOpenQuizzes}>
            <ListChecks size={14} strokeWidth={2} /> Quizzes
          </button>
          <span className="points-pill">
            <Coins size={13} strokeWidth={2} /> {user?.points ?? 0} pts
          </span>
        </div>

        <div className="account-row">
          <button className="account-identity" onClick={onEditProfile} title="Edit profile">
            <Avatar url={user?.avatar_url} emoji={null} size={28} />
            <span className="account-name">{user?.name}</span>
            <Pencil size={12} className="account-edit-icon" strokeWidth={2} />
          </button>
          <div className="account-actions">
            {isAdmin && (
              <button className="icon-btn" onClick={onOpenAdminQuizzes} title="Manage quizzes (admin)" aria-label="Manage quizzes">
                <Settings2 size={16} strokeWidth={2} />
              </button>
            )}
            <button className="icon-btn" onClick={onLogout} title="Log out" aria-label="Log out">
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="character-grid">
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            active={c.id === activeId}
            onSelect={onSelect}
            onEdit={isAdmin ? onEditCharacter : null}
            onUnlockClick={onUnlockClick}
          />
        ))}
        {characters.length === 0 && (
          <p className="hint" style={{ gridColumn: "1 / -1" }}>No characters match your search.</p>
        )}
        {isAdmin && (
          <button className="add-character-tile" onClick={onAddClick}>
            <span className="add-plus"><Plus size={22} strokeWidth={2} /></span>
            <span>Summon a new sage</span>
          </button>
        )}
      </div>
    </aside>
  );
}
