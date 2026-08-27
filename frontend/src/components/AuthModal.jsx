import { useState } from "react";
import { login, signup } from "../services/api.js";

export default function AuthModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) return;
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await login({ email: email.trim(), password })
          : await signup({ name: name.trim(), email: email.trim(), password });
      onAuthed(data.user);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "login" ? "Welcome back" : "Create your account"}</h3>
        <p className="hint">
          {mode === "login"
            ? "Log in so your conversations and progress follow you across devices."
            : "Sign up to keep your conversation history and scores saved."}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Continue as guest
            </button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "…" : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </div>
        </form>
        <p className="hint" style={{ marginTop: 14, cursor: "pointer" }}
           onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Create an account instead." : "Already have an account? Log in instead."}
        </p>
      </div>
    </div>
  );
}
