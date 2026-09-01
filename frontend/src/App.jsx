import { useEffect, useState } from "react";
import { Menu, TriangleAlert } from "lucide-react";
import CharacterGallery from "./components/CharacterGallery.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import AddCharacterModal from "./components/AddCharacterModal.jsx";
import AuthModal from "./components/AuthModal.jsx";
import EditProfileModal from "./components/EditProfileModal.jsx";
import EditCharacterModal from "./components/EditCharacterModal.jsx";
import UnlockModal from "./components/UnlockModal.jsx";
import SubscribeModal from "./components/SubscribeModal.jsx";
import QuizListModal from "./components/QuizListModal.jsx";
import AdminQuizModal from "./components/AdminQuizModal.jsx";
import OnboardingTour, { hasSeenTour } from "./components/OnboardingTour.jsx";
import LanguageSelector, { FALLBACK_LANGUAGES } from "./components/LanguageSelector.jsx";
import { fetchCategories, fetchCharacters, fetchMe, getToken, logout } from "./services/api.js";
import "./styles/App.css";

// One id per browser tab/session — used for pre-login guest polish (e.g.
// character list loads instantly behind the auth gate) even though every
// actual conversation now belongs to a signed-in account.
const SESSION_ID = crypto.randomUUID();

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [activeId, setActiveId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [unlockingCharacter, setUnlockingCharacter] = useState(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showQuizzes, setShowQuizzes] = useState(false);
  const [showAdminQuizzes, setShowAdminQuizzes] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false); // becomes true once we know whether a saved session is valid
  const [loadError, setLoadError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("hos-language") || "en"
  );

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    localStorage.setItem("hos-language", language);
  }, [language]);

  // Login is mandatory — the app-shell below only renders once `user` is
  // set. Restore a saved session if the token is still valid; otherwise
  // fall through to the sign-in gate.
  useEffect(() => {
    if (getToken()) {
      fetchMe()
        .then((u) => setUser(u))
        .catch(() => logout()) // stale/expired token
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // Character list depends on who's asking (unlock status is per-user) and
  // on the search/category filters — refetch whenever any of those change,
  // but only once we're actually signed in.
  useEffect(() => {
    if (!user) return;
    fetchCharacters({ search, category })
      .then((data) => {
        setCharacters(data);
        setActiveId((prev) => (data.some((c) => c.id === prev) ? prev : data[0]?.id ?? null));
      })
      .catch(() => setLoadError("Could not reach the backend. Is it running on the configured URL?"));
  }, [user, search, category]);

  useEffect(() => {
    if (!user) return;
    fetchCategories().then(setCategories).catch(() => {});
  }, [user]);

  // First-time onboarding tour — shows once per browser (localStorage flag),
  // right after sign-in, and can be reopened anytime from the "?" icon.
  useEffect(() => {
    if (user && !hasSeenTour()) setShowTour(true);
  }, [user]);

  const activeCharacter = characters.find((c) => c.id === activeId) || null;
  const speechLocale =
    FALLBACK_LANGUAGES.find((l) => l.code === language)?.speech_locale || "en-US";

  function refreshCharacterList() {
    fetchCharacters({ search, category }).then(setCharacters).catch(() => {});
  }

  function handleCreated(newCharacter) {
    setCharacters((prev) => [...prev, newCharacter]);
    setActiveId(newCharacter.id);
    setShowAddModal(false);
    fetchCategories().then(setCategories).catch(() => {});
  }

  function handleCharacterUpdated(updated) {
    setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingCharacter(null);
    fetchCategories().then(setCategories).catch(() => {});
  }

  function handleSelect(c) {
    setActiveId(c.id);
    setSidebarOpen(false);
  }

  function handleAuthed(loggedInUser) {
    setUser(loggedInUser);
  }

  function handleProfileUpdated(updatedUser) {
    setUser(updatedUser);
    setShowEditProfile(false);
  }

  function handleLogout() {
    logout();
    setUser(null);
    setCharacters([]);
    setActiveId(null);
  }

  // Points changed (quiz reward) or a character got unlocked — refresh
  // both the user (points/unlocked list) and the character list (so lock
  // badges update immediately) instead of trusting stale local state.
  function refreshUserAndCharacters() {
    fetchMe().then(setUser).catch(() => {});
    refreshCharacterList();
  }

  function handleUnlocked(updatedCharacter) {
    setCharacters((prev) => prev.map((c) => (c.id === updatedCharacter.id ? updatedCharacter : c)));
    setUnlockingCharacter(null);
    fetchMe().then(setUser).catch(() => {});
  }

  function handleSubscribed() {
    setShowSubscribe(false);
    setUnlockingCharacter(null);
    refreshUserAndCharacters();
  }

  // Not signed in yet — show only the sign-in gate (no character list, no
  // chat, nothing else usable) until sign-in succeeds. This is what makes
  // login/signup mandatory: the rest of the UI simply never mounts.
  if (!authChecked) {
    return <div className="auth-boot-screen" aria-hidden="true" />;
  }
  if (!user) {
    return <AuthModal mandatory onAuthed={handleAuthed} />;
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <header className="mobile-topbar">
        <button
          className="icon-btn hamburger"
          aria-label="Toggle character list"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <Menu size={20} strokeWidth={2} />
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
        onEditCharacter={setEditingCharacter}
        onUnlockClick={setUnlockingCharacter}
        language={language}
        onLanguageChange={setLanguage}
        user={user}
        isAdmin={isAdmin}
        onEditProfile={() => setShowEditProfile(true)}
        onLogout={handleLogout}
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        onOpenQuizzes={() => setShowQuizzes(true)}
        onOpenAdminQuizzes={() => setShowAdminQuizzes(true)}
        onOpenTour={() => setShowTour(true)}
      />

      {loadError ? (
        <section className="chat-panel">
          <div className="messages">
            <div className="empty-state">
              <div className="medallion medallion-lg"><TriangleAlert size={28} strokeWidth={1.75} /></div>
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
          onEditCharacter={isAdmin ? setEditingCharacter : undefined}
          onUnlockClick={setUnlockingCharacter}
        />
      )}

      {showAddModal && (
        <AddCharacterModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}

      {editingCharacter && (
        <EditCharacterModal
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onUpdated={handleCharacterUpdated}
        />
      )}

      {unlockingCharacter && (
        <UnlockModal
          character={unlockingCharacter}
          user={user}
          onClose={() => setUnlockingCharacter(null)}
          onUnlocked={handleUnlocked}
          onOpenSubscribe={() => setShowSubscribe(true)}
        />
      )}

      {showSubscribe && (
        <SubscribeModal user={user} onClose={() => setShowSubscribe(false)} onSubscribed={handleSubscribed} />
      )}

      {showQuizzes && (
        <QuizListModal
          characters={characters}
          onClose={() => setShowQuizzes(false)}
          onPointsAwarded={(totalPoints) => setUser((prev) => (prev ? { ...prev, points: totalPoints } : prev))}
        />
      )}

      {showAdminQuizzes && isAdmin && (
        <AdminQuizModal
          characters={characters}
          categories={categories}
          onClose={() => setShowAdminQuizzes(false)}
        />
      )}

      {showEditProfile && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onUpdated={handleProfileUpdated}
        />
      )}

      {showTour && <OnboardingTour isAdmin={isAdmin} onClose={() => setShowTour(false)} />}
    </div>
  );
}
