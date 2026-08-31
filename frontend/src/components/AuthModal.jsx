import { useEffect, useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { googleLogin, login, signup } from "../services/api.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Loads Google's Identity Services script once and renders its own button
// into `buttonRef`. Kept self-contained so AuthModal doesn't need to know
// about <script> tags — it just gets an onCredential(idToken) callback.
function GoogleSignInButton({ onCredential }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function render() {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        width: 320,
        text: "continue_with",
      });
    }

    if (window.google?.accounts?.id) {
      render();
      return;
    }
    const existing = document.getElementById("google-identity-script");
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-identity-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div className="google-btn-wrap" ref={buttonRef} />;
}

// `mandatory`: when true, this renders as a full-screen gate with no close
// button and no "continue as guest" escape hatch — the app behind it stays
// hidden until sign-in succeeds. When false, it behaves as a dismissible
// modal (kept for any future optional-auth flows).
export default function AuthModal({ onClose, onAuthed, mandatory = false }) {
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

  async function handleGoogleCredential(idToken) {
    setError("");
    setLoading(true);
    try {
      const data = await googleLogin({ idToken });
      onAuthed(data.user);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Google sign-in failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const body = (
    <div className={`modal ${mandatory ? "modal-gate" : ""}`} onClick={(e) => e.stopPropagation()}>
      {mandatory && (
        <div className="auth-gate-brand">
          <span className="auth-gate-icon"><Landmark size={22} strokeWidth={1.75} /></span>
          <p className="hall-eyebrow">Hall of Sages</p>
        </div>
      )}
      <h3>{mode === "login" ? "Welcome back" : "Create your account"}</h3>
      <p className="hint">
        {mode === "login"
          ? "Log in to start talking with history — your conversations follow you across devices."
          : "Sign up to start talking with history and keep your conversation history saved."}
      </p>

      <GoogleSignInButton onCredential={handleGoogleCredential} />
      {GOOGLE_CLIENT_ID && (
        <div className="auth-divider"><span>or</span></div>
      )}

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
          {!mandatory && (
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancel
            </button>
          )}
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
  );

  if (mandatory) {
    return <div className="auth-gate-backdrop">{body}</div>;
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      {body}
    </div>
  );
}
