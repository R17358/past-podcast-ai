import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";
import { sendMessage, resetChat, fetchVoice, fetchVision, stopCurrentVoice, playVoice } from "../services/api.js";
import CameraCaptureModal from "./CameraCaptureModal.jsx";

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// How long to wait, after the user stops producing new speech, before we
// treat it as "they're done talking" and submit the turn. This is OUR OWN
// timer (not the browser's built-in end-of-speech guess), so it's the one
// knob to tune if turns are cut off too early or feel too laggy.
const SILENCE_TIMEOUT_MS = 1400;

// A ~50ms silent WAV. Played once, synchronously, inside a real click handler
// so the browser treats the <audio> element as "unlocked" for autoplay —
// every later programmatic .play() on that same element (loading a real TTS
// mp3) is then allowed, even mid-conversation with no fresh click. This is
// the actual fix for "voice mode doesn't say anything back": without it,
// mobile Safari / some Chrome builds silently reject the later play().
const SILENT_AUDIO_SRC =
  "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

// Strips things that would sound garbled or nonsensical if read aloud
// verbatim — fenced code blocks and LaTeX math — replacing each with a
// short spoken filler, then strips remaining markdown symbols.
function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, " I've written that out in the code block above. ")
    .replace(/\$\$[\s\S]*?\$\$/g, " — shown as an equation above. ")
    .replace(/\$[^$\n]+\$/g, " — shown as an equation above. ")
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
  const [cameraBusy, setCameraBusy] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);

  const scrollRef = useRef(null);
  const callScrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null); // persistent <audio> element, see SILENT_AUDIO_SRC comment
  const voiceModeRef = useRef(false);
  const callStateRef = useRef("idle");
  const speakStartedAtRef = useRef(0);
  const cameraOpenRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const micMutedRef = useRef(false);
  const speakerMutedRef = useRef(false);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
  }, [speakerMuted]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

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

  // Sets both the state (for render) and the ref (readable synchronously,
  // right in this same tick — startListening()'s camera guard needs that,
  // since React state updates don't apply until the next render).
  function setCameraModalOpen(open) {
    cameraOpenRef.current = open;
    setShowCameraModal(open);
  }

  function endCall() {
    clearTimeout(silenceTimerRef.current);
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* no-op */
    }
    recognitionRef.current = null;
    stopCurrentVoice();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCallState("idle");
    setLiveCaption("");
  }

  function startListening() {
    if (!voiceModeRef.current || cameraOpenRef.current || micMutedRef.current) return;
    if (recognitionRef.current) return; // already have a live session — don't stack another one
    if (!SpeechRecognitionAPI) {
      setVoiceError("Voice input isn't supported in this browser — try Chrome or Edge.");
      setVoiceMode(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = speechLocale;
    recognition.interimResults = true;
    // continuous:true + our own silence timer (below) means the mic stays
    // open across an entire turn instead of the browser auto-stopping and
    // us restarting it — that start/stop cycling was what caused the
    // frequent "listening" chime and the mic feeling like it was cutting
    // people off mid-sentence.
    recognition.continuous = true;
    finalTranscriptRef.current = "";

    recognition.onstart = () => {
      if (callStateRef.current !== "speaking") setCallState("listening");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += transcript;
        else interim += transcript;
      }
      if (newFinal) finalTranscriptRef.current += newFinal;
      setLiveCaption((finalTranscriptRef.current + interim).trim());

      const spokenText = (finalTranscriptRef.current + interim).trim();

      // Barge-in: the user has started actually talking while the AI is
      // mid-reply — cut it off immediately.
      const speakingLongEnough = Date.now() - speakStartedAtRef.current > 800;
      if (spokenText.length >= 4 && speakingLongEnough && callStateRef.current === "speaking") {
        stopCurrentVoice();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setCallState("listening");
      }

      // This IS the "how long to wait after they stop talking" delay —
      // every new word resets it, so it only fires once they've genuinely
      // paused, not the instant they take a breath.
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (finalTranscriptRef.current.trim()) {
          try {
            recognition.stop(); // graceful stop -> onend below submits the turn
          } catch {
            /* already stopped */
          }
        }
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceError("Mic error: " + event.error);
      }
    };

    recognition.onend = () => {
      clearTimeout(silenceTimerRef.current);
      recognitionRef.current = null;
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        handleVoiceTurn(finalText);
      } else if (voiceModeRef.current && !cameraOpenRef.current) {
        // Recognition ended with nothing said (e.g. some browsers force-end
        // a session after ~60s regardless of continuous:true) — quietly
        // reopen it rather than leaving the call dead.
        startListening();
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
    stopCurrentVoice();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLiveCaption("");
    setCallState("thinking");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const data = await sendMessage({ characterId: character.id, sessionId, message: text, language });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      speak(data.reply); // fire-and-forget — mic re-opens right below, WHILE this plays
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "(The connection to this era was lost. Please try again.)" },
      ]);
    }
    if (voiceModeRef.current) startListening();
  }

  async function speak(text) {
    if (speakerMutedRef.current) {
      // Speaker is muted — don't fetch or play any audio at all, cloud or
      // browser fallback. Still resolve promptly so the caller (which calls
      // startListening() right after) doesn't wait on anything.
      return;
    }
    setCallState("speaking");
    speakStartedAtRef.current = Date.now();
    setVoiceError("");
    const clean = cleanForSpeech(text);
    try {
      const url = await fetchVoice({ characterId: character.id, text: clean, language });
      const audio = audioRef.current;
      if (!audio) throw new Error("no audio element");
      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = () => reject(new Error("audio element playback error"));
        playVoice(url, audio).catch(reject);
      });
    } catch (err) {
      if (callStateRef.current === "speaking") {
        setVoiceError("Couldn't reach the cloud voice — using your browser's built-in voice instead.");
        await speakWithBrowserVoice(clean, speechLocale);
      }
    }
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      setVoiceMode(false);
      endCall();
    } else {
      setVoiceError("");
      setVoiceMode(true);
      // Start each new call with both unmuted — muting is a per-call choice,
      // not something that should silently carry over from last time.
      setMicMuted(false);
      micMutedRef.current = false;
      setSpeakerMuted(false);
      speakerMutedRef.current = false;
      if (audioRef.current) {
        audioRef.current.src = SILENT_AUDIO_SRC;
        audioRef.current.play().catch(() => {});
      }
      startListening();
    }
  }

  function toggleMic() {
    const next = !micMuted;
    setMicMuted(next);
    micMutedRef.current = next;
    if (next) {
      // Muting mid-call: stop listening right away rather than waiting for
      // the current silence timer to expire.
      clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* no-op */
      }
      recognitionRef.current = null;
      setLiveCaption("");
      if (callStateRef.current !== "speaking") setCallState("idle");
    } else if (!cameraOpenRef.current) {
      startListening();
    }
  }

  function toggleSpeaker() {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    speakerMutedRef.current = next;
    if (next) {
      // Muting mid-reply: cut off whatever's currently playing immediately.
      stopCurrentVoice();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (callStateRef.current === "speaking") setCallState("listening");
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

  // Opening the camera now explicitly stops the mic/voice first — camera
  // and mic fighting for control was exactly what caused it to keep
  // talking/listening unpredictably while the camera was up.
  function handleCameraOpen() {
    setVoiceError("");
    clearTimeout(silenceTimerRef.current);
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* no-op */
    }
    recognitionRef.current = null;
    stopCurrentVoice();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCameraModalOpen(true);
  }

  async function handleCameraCapture(imageBase64, question) {
    setCameraModalOpen(false);
    setCameraBusy(true);
    try {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question || "Here's what I'm showing you.", image: imageBase64 },
      ]);
      setIsTyping(true);
      const data = await fetchVision({ characterId: character.id, sessionId, imageBase64, question, language });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (voiceModeRef.current) {
        speak(data.reply);
        startListening(); // mic was off for the whole camera flow — resume it now, same as after a normal voice turn
      }
    } catch (err) {
      setVoiceError("Couldn't process that image — please try again.");
    } finally {
      setIsTyping(false);
      setCameraBusy(false);
    }
  }

  async function handleClear() {
    await resetChat({ characterId: character.id, sessionId });
    setMessages([]);
  }

  const baseStatusText = {
    listening: "Listening…",
    thinking: `${character.name} is thinking…`,
    speaking: `${character.name} is speaking…`,
    idle: "Tap the orb to speak",
  }[callState];
  const statusText = [
    baseStatusText,
    micMuted ? "· mic muted" : null,
    speakerMuted ? "· speaker muted" : null,
  ].filter(Boolean).join(" ");

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

          <div className="call-actions">
            <button className="ghost-btn" onClick={handleCameraOpen} disabled={cameraBusy} title="Show something via camera">
              {cameraBusy ? "📷…" : "📷 Show"}
            </button>
            <button
              className={`icon-toggle-btn ${micMuted ? "muted" : ""}`}
              onClick={toggleMic}
              title={micMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {micMuted ? "🎙️🚫" : "🎙️"}
            </button>
            <button
              className={`icon-toggle-btn ${speakerMuted ? "muted" : ""}`}
              onClick={toggleSpeaker}
              title={speakerMuted ? "Unmute speaker" : "Mute speaker"}
            >
              {speakerMuted ? "🔇" : "🔊"}
            </button>
            <button className="hang-up-btn" onClick={toggleVoiceMode}>End call</button>
          </div>
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
              <MessageBubble key={i} role={m.role} content={m.content} image={m.image} character={character} language={language} />
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
            <button className="ghost-btn camera-btn" onClick={handleCameraOpen} disabled={cameraBusy} title="Show something via camera">
              {cameraBusy ? "📷…" : "📷"}
            </button>
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
      {showCameraModal && (
        <CameraCaptureModal onCapture={handleCameraCapture} onClose={() => setCameraModalOpen(false)} />
      )}
    </section>
  );
}
