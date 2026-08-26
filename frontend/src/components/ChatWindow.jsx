import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";
import { sendMessage, resetChat, fetchVoice } from "../services/api.js";

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// A ~50ms silent WAV. Played once, synchronously, inside a real click handler
// so the browser treats the <audio> element as "unlocked" for autoplay —
// every later programmatic .play() on that same element (loading a real TTS
// mp3) is then allowed, even mid-conversation with no fresh click. This is
// the actual fix for "voice mode doesn't say anything back": without it,
// mobile Safari / some Chrome builds silently reject the later play().
const SILENT_AUDIO_SRC =
  "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

// Strips markdown / asterisk stage-directions so TTS doesn't try to speak symbols aloud
function cleanForSpeech(text) {
  return text
    .replace(/\*[^*]*\*/g, " ")
    .replace(/[*_#`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Last-resort fallback: if the ElevenLabs call fails (missing key, quota,
// network), use the browser's own built-in voice so the character still
// speaks instead of the app going silent.
function speakWithBrowserVoice(text, speechLocale) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = speechLocale || "en-US";
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

export default function ChatWindow({ character, sessionId, language = "en", speechLocale = "en-US" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // ---- Voice / live-call mode ----
  const [voiceMode, setVoiceMode] = useState(false);
  const [callState, setCallState] = useState("idle"); // idle | listening | thinking | speaking
  const [liveCaption, setLiveCaption] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const scrollRef = useRef(null);
  const callScrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null); // persistent <audio> element, see SILENT_AUDIO_SRC comment
  const voiceModeRef = useRef(false);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Reset conversation + stop any live call whenever the chosen character changes
  useEffect(() => {
    setMessages([]);
    setInput("");
    endCall();
    setVoiceMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    callScrollRef.current?.scrollTo({ top: callScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => () => endCall(), []); // cleanup on unmount

  if (!character) {
    return (
      <section className="chat-panel">
        <div className="messages">
          <div className="empty-state">
            <div className="medallion">🏛️</div>
            <h2>Choose a sage to begin</h2>
            <p>Pick a character from the Hall to start a conversation.</p>
          </div>
        </div>
      </section>
    );
  }

  function endCall() {
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* no-op */
    }
    recognitionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCallState("idle");
    setLiveCaption("");
  }

  function startListening() {
    if (!voiceModeRef.current) return;
    if (!SpeechRecognitionAPI) {
      setVoiceError("Voice input isn't supported in this browser — try Chrome or Edge.");
      setVoiceMode(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = speechLocale;
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = "";

    recognition.onstart = () => setCallState("listening");
    recognition.onresult = (event) => {
      let interim = "";
      finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      setLiveCaption(interim || finalText);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceError("Mic error: " + event.error);
      }
    };
    recognition.onend = () => {
      if (finalText.trim()) {
        handleVoiceTurn(finalText.trim());
      } else if (voiceModeRef.current) {
        startListening(); // just silence — keep the line open
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* recognition already running */
    }
  }

  async function handleVoiceTurn(text) {
    setLiveCaption("");
    setCallState("thinking");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const data = await sendMessage({ characterId: character.id, sessionId, message: text, language });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      await speak(data.reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "(The connection to this era was lost. Please try again.)" },
      ]);
    }
    if (voiceModeRef.current) startListening();
  }

  async function speak(text) {
    setCallState("speaking");
    setVoiceError("");
    const clean = cleanForSpeech(text);
    try {
      const url = await fetchVoice({ characterId: character.id, text: clean, language });
      await new Promise((resolve, reject) => {
        const audio = audioRef.current;
        if (!audio) return reject(new Error("no audio element"));
        audio.src = url;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error("audio element playback error"));
        audio.play().then(() => {}).catch(reject);
      });
    } catch (err) {
      // ElevenLabs failed (missing/invalid API key, quota, network, or the
      // browser blocked autoplay) — fall back to the browser's own voice
      // instead of the character going silent.
      setVoiceError("Couldn't reach the cloud voice — using your browser's built-in voice instead.");
      await speakWithBrowserVoice(clean, speechLocale);
    }
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      setVoiceMode(false);
      endCall();
    } else {
      setVoiceError("");
      setVoiceMode(true);
      // Unlock autoplay for this <audio> element inside this real click —
      // required so later programmatic play() calls (after each AI reply)
      // aren't silently blocked by the browser.
      if (audioRef.current) {
        audioRef.current.src = SILENT_AUDIO_SRC;
        audioRef.current.play().catch(() => {});
      }
      startListening();
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsTyping(true);
    try {
      const data = await sendMessage({ characterId: character.id, sessionId, message: text, language });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "(The connection to this era was lost. Please try again.)" },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleClear() {
    await resetChat({ characterId: character.id, sessionId });
    setMessages([]);
  }

  const statusText = {
    listening: "Listening…",
    thinking: `${character.name} is thinking…`,
    speaking: `${character.name} is speaking…`,
    idle: "Tap the orb to speak",
  }[callState];

  return (
    <section className="chat-panel">
      <audio ref={audioRef} preload="auto" />

      <header className="chat-header">
        <div className="medallion">{character.avatar_emoji}</div>
        <div className="chat-header-info">
          <p className="chat-header-name">{character.name}</p>
          <p className="chat-header-title">{character.title}{character.era ? ` · ${character.era}` : ""}</p>
        </div>
        <div className="chat-header-actions">
          <button className="ghost-btn" onClick={handleClear}>Start over</button>
          <button
            className={`voice-toggle ${voiceMode ? "on" : ""}`}
            role="switch"
            aria-checked={voiceMode}
            onClick={toggleVoiceMode}
            title={voiceMode ? "End live voice call" : "Start live voice call"}
          >
            <span className="voice-toggle-icon">{voiceMode ? "🎙️" : "💬"}</span>
            <span className="voice-toggle-track">
              <span className="voice-toggle-thumb" />
            </span>
          </button>
        </div>
      </header>

      {voiceError && <div className="voice-error-banner">⚠️ {voiceError}</div>}

      {voiceMode ? (
        <div className="call-view">
          <div className={`call-orb call-orb--${callState}`} onClick={() => callState === "idle" && startListening()}>
            <span className="call-orb-ring call-orb-ring--1" />
            <span className="call-orb-ring call-orb-ring--2" />
            <span className="call-orb-avatar">{character.avatar_emoji}</span>
          </div>
          <p className="call-status">{statusText}</p>
          {liveCaption && <p className="call-caption">"{liveCaption}"</p>}

          <div className="call-transcript" ref={callScrollRef}>
            {messages.slice(-8).map((m, i) => (
              <p key={i} className={`call-line ${m.role}`}>
                <span className="call-line-speaker">{m.role === "user" ? "You" : character.name}</span>
                {m.content}
              </p>
            ))}
          </div>

          <button className="hang-up-btn" onClick={toggleVoiceMode}>End call</button>
        </div>
      ) : (
        <>
          <div className="messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="medallion">{character.avatar_emoji}</div>
                <h2>{character.name} is listening</h2>
                <p>{character.description}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} character={character} language={language} />
            ))}
            {isTyping && (
              <div className="bubble-row character">
                <div className="bubble-mini-avatar">{character.avatar_emoji}</div>
                <div className="bubble">
                  <span className="typing-dots"><span></span><span></span><span></span></span>
                </div>
              </div>
            )}
          </div>

          <div className="composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={`Ask ${character.name} something…`}
            />
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isTyping}>
              ➤
            </button>
          </div>
        </>
      )}
    </section>
  );
}
