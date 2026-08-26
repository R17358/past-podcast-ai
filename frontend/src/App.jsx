import { useEffect, useState } from "react";
import CharacterGallery from "./components/CharacterGallery.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import AddCharacterModal from "./components/AddCharacterModal.jsx";
import LanguageSelector, { FALLBACK_LANGUAGES } from "./components/LanguageSelector.jsx";
import { fetchCharacters } from "./services/api.js";
import "./styles/App.css";

// One id per browser tab/session — keeps each visitor's conversation memory separate
const SESSION_ID = crypto.randomUUID();

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
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
    </div>
  );
}
