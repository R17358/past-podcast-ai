import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { fetchVoice, playVoice } from "../services/api.js";

// Renders a fenced code block with a syntax-highlighted-ish monospace box
// and a "Copy" button. react-markdown gives us <code> inside <pre> for
// fenced blocks (with a className like "language-python") and a bare
// <code> with no parent <pre> for inline code — we only add the copy
// button/box treatment to the fenced (block) case.
function CodeBlock({ className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const isBlock = /language-/.test(className || "") || String(children).includes("\n");

  if (!isBlock) {
    return <code className="inline-code" {...props}>{children}</code>;
  }

  const codeText = String(children).replace(/\n$/, "");
  const language = (className || "").replace("language-", "") || "text";

  function handleCopy() {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <button className="code-copy-btn" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre>
        <code className={className} {...props}>{codeText}</code>
      </pre>
    </div>
  );
}

export default function MessageBubble({ role, content, image, character, language = "en" }) {
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");

  const isUser = role === "user";

  async function handleListen() {
    setError("");
    if (audioUrl) {
      playVoice(audioUrl).catch(() => setError("Playback blocked by browser."));
      return;
    }
    setLoadingAudio(true);
    try {
      const url = await fetchVoice({ characterId: character.id, text: content, language });
      setAudioUrl(url);
      await playVoice(url);
    } catch (err) {
      console.error("Voice generation failed", err);
      setError("Voice unavailable right now.");
    } finally {
      setLoadingAudio(false);
    }
  }

  return (
    <div className={`bubble-row ${isUser ? "user" : "character"}`}>
      {!isUser && <div className="bubble-mini-avatar">{character.avatar_emoji}</div>}
      <div className="bubble-col">
        <div className="bubble">
          {image && <img src={image} alt="Shown to character" className="shared-image-preview" />}
          {isUser ? (
            // User messages stay plain text — no need to run them through a
            // markdown parser, and it avoids a raw "**" or "$" a user typed
            // being (mis)interpreted as formatting.
            <p>{content}</p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{ code: CodeBlock }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="bubble-meta">
            <button className="listen-btn" onClick={handleListen} disabled={loadingAudio}>
              {loadingAudio ? "Conjuring voice…" : "🔊 Listen"}
            </button>
            {error && <span className="bubble-error">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
