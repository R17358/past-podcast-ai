import { useEffect, useState } from "react";
import CharacterGallery from "./components/CharacterGallery.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import AddCharacterModal from "./components/AddCharacterModal.jsx";
import { fetchCharacters } from "./services/api.js";
import "./styles/App.css";

// One id per browser tab/session — keeps each visitor's conversation memory separate
const SESSION_ID = crypto.randomUUID();

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetchCharacters()
      .then((data) => {
        setCharacters(data);
        if (data.length) setActiveId(data[0].id);
      })
      .catch(() => setLoadError("Could not reach the backend. Is it running on the configured URL?"));
  }, []);

  const activeCharacter = characters.find((c) => c.id === activeId) || null;

  function handleCreated(newCharacter) {
    setCharacters((prev) => [...prev, newCharacter]);
    setActiveId(newCharacter.id);
    setShowAddModal(false);
  }

  return (
    <div className="app-shell">
      <CharacterGallery
        characters={characters}
        activeId={activeId}
        onSelect={(c) => setActiveId(c.id)}
        onAddClick={() => setShowAddModal(true)}
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
        <ChatWindow character={activeCharacter} sessionId={SESSION_ID} />
      )}

      {showAddModal && (
        <AddCharacterModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
