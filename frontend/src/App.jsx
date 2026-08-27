import { useEffect, useState } from "react";
import CharacterGallery from "./components/CharacterGallery.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import AddCharacterModal from "./components/AddCharacterModal.jsx";
import AuthModal from "./components/AuthModal.jsx";
import LanguageSelector, { FALLBACK_LANGUAGES } from "./components/LanguageSelector.jsx";
import { fetchCharacters, fetchMe, getToken, logout } from "./services/api.js";
import "./styles/App.css";

// One id per browser tab/session — keeps each guest visitor's conversation
// memory separate. Logged-in users' memory follows their account instead
// (see backend/app/services/memory_service.py), this id just becomes unused for them.
const SESSION_ID = crypto.randomUUID();

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("hos-language") || "en"
  );

  useEffect(() => {
    localStorage.setItem("hos-language", language);
  }, [language]);

  useEffect(() => {
    fetchCharacters()
      .then((data) => {
        setCharacters(data);
        if (data.length) setActiveId(data[0].id);
      })
      .catch(() => setLoadError("Could not reach the backend. Is it running on the configured URL?"));

    // Restore a logged-in session on refresh, if a token is already saved.
    if (getToken()) {
      fetchMe()
        .then(setUser)
        .catch(() => logout()); // stale/expired token — fall back to guest silently
    }
  }, []);

  const activeCharacter = characters.find((c) => c.id === activeId) || null;
  const speechLocale =
    FALLBACK_LANGUAGES.find((l) => l.code === language)?.speech_locale || "en-US";

  function handleCreated(newCharacter) {
    setCharacters((prev) => [...prev, newCharacter]);
    setActiveId(newCharacter.id);
    setShowAddModal(false);
  }

  function handleSelect(c) {
    setActiveId(c.id);
    setSidebarOpen(false);
  }

  function handleAuthed(loggedInUser) {
    setUser(loggedInUser);
    setShowAuthModal(false);
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <header className="mobile-topbar">
        <button
          className="icon-btn hamburger"
          aria-label="Toggle character list"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <p className="mobile-topbar-title">
          Hall of <em>Sages</em>
        </p>
        <LanguageSelector value={language} onChange={setLanguage} compact />
      </header>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <CharacterGallery
        characters={characters}
        activeId={activeId}
        onSelect={handleSelect}
        onAddClick={() => {
          setShowAddModal(true);
          setSidebarOpen(false);
        }}
        language={language}
        onLanguageChange={setLanguage}
        user={user}
        onAuthClick={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {loadError ? (
        <section className="chat-panel">
          <div className="messages">
            <div className="empty-state">
              <div className="medallion">⚠️</div>
              <h2>Backend unreachable</h2>
              <p>{loadError}</p>
            </div>
          </div>
        </section>
      ) : (
        <ChatWindow
          character={activeCharacter}
          sessionId={SESSION_ID}
          language={language}
          speechLocale={speechLocale}
        />
      )}

      {showAddModal && (
        <AddCharacterModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onAuthed={handleAuthed} />
      )}
    </div>
  );
}
