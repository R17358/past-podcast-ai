import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MessageCircle, Phone, PhoneOff, Volume2, VolumeX, Camera, Landmark, Send, AlertTriangle, Pencil } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";
import { sendMessage, resetChat, fetchVoice, fetchVision, stopCurrentVoice, playVoice } from "../services/api.js";
import CameraCaptureModal from "./CameraCaptureModal.jsx";
import Avatar from "./Avatar.jsx";

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// How long to wait, after the user stops producing new speech, before we
// treat it as "they're done talking" and submit the turn. Every new word
// resets this timer, so a short pause to think mid-sentence won't cut you
// off — it only fires once you've genuinely stopped. This is the one knob
// to tune if turns feel cut off too early (raise it) or too slow (lower it).
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

// Merges a newly-finalized speech segment into the transcript accumulated so
// far. This has to handle two very different real-world behaviors of the Web
// Speech API depending on device/browser:
//  1. Normal (most desktop Chrome): each final segment is genuinely NEW
//     content, so segments should be concatenated in order.
//  2. Android Chrome quirk (this is what was causing "who who are who are
//     you" / "तुमको तुमको आवाज..."): the engine finalizes a fresh, GROWING
//     restatement of the whole utterance so far as each new segment — e.g.
//     "तुमको" then "तुमको आवाज" then "तुमको आवाज आ रही है" — each one a
//     superset of the last, not the next incremental word. It also does
//     this across genuinely different result-array INDICES, not just by
//     re-firing the same index, so simply de-duping by index (the previous
//     fix) isn't enough.
// The fix: if the incoming segment already contains everything we've
// accumulated, it's case 2 — replace, don't append. If what we've
// accumulated already contains the incoming segment, it's a redundant
// re-fire of an already-captured segment — ignore it. Otherwise it's
// genuinely new content — append it.
function mergeFinalSegment(existing, incoming) {
  const e = existing.trim();
  const inc = incoming.trim();
  if (!e) return inc;
  if (!inc) return e;
  const eLower = e.toLowerCase();
  const incLower = inc.toLowerCase();
  if (incLower.includes(eLower)) return inc; // incoming is a fuller restatement — replace
  if (eLower.includes(incLower)) return e; // incoming is already covered — ignore
  return `${e} ${inc}`.trim(); // genuinely new content — append
}

export default function ChatWindow({ character, sessionId, language = "en", speechLocale = "en-US", onEditCharacter }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // ---- Voice / live-call mode ----
  // Strictly turn-by-turn: mic is ONLY ever listening in the "listening"
  // state. It is never active while the AI is "speaking" or "thinking" —
  // that's what was causing the AI to hear its own voice and misfire
  // interrupts. The only way to interrupt the AI now is the explicit mic
  // button (or tapping the orb) — a deliberate action, not automatic
  // voice-activated detection, so there's no echo to misread.
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
  const cameraOpenRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const micMutedRef = useRef(false);
  const speakerMutedRef = useRef(false);
  const speakResolveRef = useRef(null); // lets a manual interrupt cleanly resolve the pending speak() promise instead of leaving it hanging

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

  // Sets both the React state (for render) AND the ref (readable
  // synchronously in the same tick) together. This matters because
  // startListening()'s "don't listen while speaking/thinking" guard reads
  // callStateRef — if only setCallState() were called, that guard would
  // still see the OLD value until the next render, which is exactly what
  // let the mic stay stuck open/closed at the wrong moments before.
  function updateCallState(next) {
    callStateRef.current = next;
    setCallState(next);
  }

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
            <div className="medallion medallion-lg"><Landmark size={28} strokeWidth={1.75} /></div>
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
    updateCallState("idle");
    setLiveCaption("");
  }

  function startListening() {
    if (!voiceModeRef.current || cameraOpenRef.current || micMutedRef.current) return;
    if (callStateRef.current === "speaking" || callStateRef.current === "thinking") return; // strictly turn-by-turn — never listen while the AI is talking or thinking
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
    // open across your ENTIRE turn — one word or twenty — instead of the
    // browser's own (much shorter, unpredictable) end-of-speech guess
    // cutting you off mid-sentence.
    recognition.continuous = true;
    finalTranscriptRef.current = "";

    recognition.onstart = () => {
      updateCallState("listening");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current = mergeFinalSegment(finalTranscriptRef.current, transcript);
        } else {
          interim += transcript;
        }
      }
      setLiveCaption((finalTranscriptRef.current + " " + interim).trim());

      // This IS the "how long to wait after they stop talking" delay —
      // every new word resets it, so it only fires once genuinely paused.
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
      } else if (voiceModeRef.current && !cameraOpenRef.current && callStateRef.current === "listening") {
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
    setLiveCaption("");
    updateCallState("thinking"); // mic is now fully closed — see the "thinking"/"speaking" guard in startListening()
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const data = await sendMessage({ characterId: character.id, sessionId, message: text, language });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      await speak(data.reply); // wait for it to finish (or be manually interrupted) before reopening the mic
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "(The connection to this era was lost. Please try again.)" },
      ]);
      // speak() always resets state back to idle/listening itself (see below),
      // but if we skipped speak() entirely because sendMessage threw, nothing
      // else has reset callState yet — do it here so the mic isn't stuck.
      if (callStateRef.current === "thinking") updateCallState("idle");
    }
    if (voiceModeRef.current) startListening(); // safe even if a manual interrupt already restarted it — startListening() no-ops if a session is already live
  }

  // FIX (bug #1 — "call gets stuck after the first reply"): this used to
  // only ever SET callState to "speaking" and never reset it back on a
  // normal (non-interrupted) finish. startListening()'s guard checks
  // callState and refuses to listen while it's "speaking" — so once the
  // very first reply finished playing, the state stayed "speaking" forever
  // and the mic never reopened on its own. Now every exit path (normal
  // finish, browser-voice fallback finish, or genuine interrupt) explicitly
  // returns callState to "idle" before this function returns.
  async function speak(text) {
    if (speakerMutedRef.current) return; // speaker muted — don't fetch or play any audio at all
    updateCallState("speaking");
    setVoiceError("");
    const clean = cleanForSpeech(text);
    let interrupted = false;
    try {
      const url = await fetchVoice({ characterId: character.id, text: clean, language });
      const audio = audioRef.current;
      if (!audio) throw new Error("no audio element");
      await new Promise((resolve, reject) => {
        speakResolveRef.current = () => {
          interrupted = true; // a manual interrupt already moved callState off "speaking" itself
          resolve();
        };
        audio.onended = resolve;
        audio.onerror = () => reject(new Error("audio element playback error"));
        playVoice(url, audio).catch(reject);
      });
    } catch (err) {
      if (callStateRef.current === "speaking") {
        setVoiceError("Couldn't reach the cloud voice — using your browser's built-in voice instead.");
        await speakWithBrowserVoice(clean, speechLocale);
      }
    } finally {
      speakResolveRef.current = null;
      // Only reset here if nothing else (an interrupt) already did — avoids
      // stomping on a state change that happened while we were mid-await.
      if (!interrupted && callStateRef.current === "speaking") {
        updateCallState("idle");
      }
    }
  }

  // Stops whatever audio is currently playing/queued, without touching mic
  // state or restarting listening — the shared building block for both
  // "interrupt to talk" (mic tap) and "mute speaker mid-reply" below, which
  // need different follow-up behavior.
  function stopSpeakingAudio() {
    stopCurrentVoice();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    speakResolveRef.current?.(); // let the pending speak() promise resolve instead of hanging forever
  }

  // The ONLY way the AI gets interrupted-to-talk: an explicit tap (mic
  // button or the orb) while it's actually speaking. Stops its voice,
  // force-unmutes the mic (you're actively trying to talk, so any earlier
  // mute shouldn't block that), and opens the mic for your next turn.
  function interruptAndListen() {
    stopSpeakingAudio();
    setMicMuted(false);
    micMutedRef.current = false;
    updateCallState("idle");
    startListening();
  }

  // FIX (bug #2 — "speaker mute forgets my mic-mute setting"): muting the
  // speaker mid-reply used to call interruptAndListen(), which force-
  // unmutes the mic every time — so muting the speaker would silently
  // un-mute a mic you'd deliberately muted. This stops the audio the same
  // way, but leaves mic-mute exactly as you left it, and only reopens the
  // mic if it wasn't muted to begin with.
  function stopSpeakingForMute() {
    stopSpeakingAudio();
    updateCallState("idle");
    if (!micMutedRef.current) {
      startListening();
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

  // FIX (bug #3 — "muting mic while thinking causes overlapping replies"):
  // this used to treat ANY mic tap during "speaking" OR "thinking" as a
  // full interrupt, which immediately reopened the mic and started a new
  // listening session — while the previous reply was still being generated
  // in the background. When that old reply finally came back, it could
  // speak/append on top of the new turn. There's nothing actually playing
  // to interrupt while "thinking" (the AI hasn't spoken yet), so a mic tap
  // in that state now just toggles mute like normal — no new listening
  // session starts until the pending reply finishes and hands control back
  // (see the "if (voiceModeRef.current) startListening()" at the end of
  // handleVoiceTurn, which already respects the fresh mute state).
  function toggleMic() {
    // Only treat this as "interrupt and start talking" when the AI is
    // actually mid-speech — tapping mic while merely "thinking" is just a
    // normal mute toggle now (see comment above).
    if (callStateRef.current === "speaking") {
      interruptAndListen();
      return;
    }
    const next = !micMuted;
    setMicMuted(next);
    micMutedRef.current = next;
    if (next) {
      clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* no-op */
      }
      recognitionRef.current = null;
      setLiveCaption("");
      if (callStateRef.current === "listening") updateCallState("idle");
    } else if (!cameraOpenRef.current && callStateRef.current === "idle") {
      startListening();
    }
  }

  function toggleSpeaker() {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    speakerMutedRef.current = next;
    if (next) {
      // Muting mid-reply: cut off whatever's currently playing immediately,
      // then — unlike a manual interrupt — respect the existing mic-mute
      // setting instead of forcing the mic back on (fix #2, see above).
      if (callStateRef.current === "speaking") {
        stopSpeakingForMute();
      }
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

  // Opening the camera explicitly stops the mic/voice first — camera and
  // mic fighting for control was what caused it to keep talking/listening
  // unpredictably while the camera was up.
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
    speakResolveRef.current?.();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    updateCallState("idle");
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
        await speak(data.reply); // mic stays closed until this finishes, same turn-by-turn rule as normal voice turns
        startListening();
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
    speaking: `${character.name} is speaking… (tap to interrupt)`,
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
        <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={44} className="medallion" />
        <div className="chat-header-info">
          <p className="chat-header-name">{character.name}</p>
          <p className="chat-header-title">{character.title}{character.era ? ` · ${character.era}` : ""}</p>
        </div>
        <div className="chat-header-actions">
          {onEditCharacter && (
            <button className="icon-btn" onClick={() => onEditCharacter(character)} title={`Edit ${character.name}`} aria-label="Edit character">
              <Pencil size={16} strokeWidth={2} />
            </button>
          )}
          <button className="ghost-btn" onClick={handleClear}>Start over</button>

          {/* Segmented slide control — replaces the old on/off toggle. The
              highlight pill slides between "Chat" and "Call" via a CSS
              transform transition (see .mode-switch-highlight in App.css),
              rather than the content just instantly swapping. */}
          <div className="mode-switch" role="tablist" aria-label="Conversation mode">
            <span className={`mode-switch-highlight ${voiceMode ? "is-call" : "is-chat"}`} aria-hidden="true" />
            <button
              role="tab"
              aria-selected={!voiceMode}
              className={`mode-switch-btn ${!voiceMode ? "active" : ""}`}
              onClick={() => voiceMode && toggleVoiceMode()}
            >
              <MessageCircle size={14} strokeWidth={2} />
              Chat
            </button>
            <button
              role="tab"
              aria-selected={voiceMode}
              className={`mode-switch-btn ${voiceMode ? "active" : ""}`}
              onClick={() => !voiceMode && toggleVoiceMode()}
            >
              <Phone size={14} strokeWidth={2} />
              Call
            </button>
          </div>
        </div>
      </header>

      {voiceError && (
        <div className="voice-error-banner">
          <AlertTriangle size={15} strokeWidth={2} /> {voiceError}
        </div>
      )}

      {voiceMode ? (
        <div className="call-view view-anim-in" key="call-view">
          <div
            className={`call-orb call-orb--${callState}`}
            onClick={() => {
              if (callState === "idle") startListening();
              else if (callState === "speaking") interruptAndListen();
            }}
          >
            <span className="call-orb-ring call-orb-ring--1" />
            <span className="call-orb-ring call-orb-ring--2" />
            <span className="call-orb-bars" aria-hidden="true">
              <span /><span /><span /><span /><span />
            </span>
            <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={72} className="call-orb-avatar" />
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
              <Camera size={15} strokeWidth={2} /> Show
            </button>
            <button
              className={`icon-toggle-btn ${micMuted ? "muted" : ""}`}
              onClick={toggleMic}
              title={
                callState === "speaking"
                  ? "Interrupt and start talking"
                  : micMuted
                  ? "Unmute microphone"
                  : "Mute microphone"
              }
            >
              {callState !== "speaking" && micMuted ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
            </button>
            <button
              className={`icon-toggle-btn ${speakerMuted ? "muted" : ""}`}
              onClick={toggleSpeaker}
              title={speakerMuted ? "Unmute speaker" : "Mute speaker"}
            >
              {speakerMuted ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
            </button>
            <button className="hang-up-btn" onClick={toggleVoiceMode}>
              <PhoneOff size={15} strokeWidth={2} /> End call
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-body view-anim-in" key="chat-view">
          <div className="messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="empty-state">
                <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={64} className="medallion medallion-lg" />
                <h2>{character.name} is listening</h2>
                <p>{character.description}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} image={m.image} character={character} language={language} />
            ))}
            {isTyping && (
              <div className="bubble-row character">
                <div className="bubble-mini-avatar">
                  <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={32} />
                </div>
                <div className="bubble">
                  <span className="typing-dots"><span></span><span></span><span></span></span>
                </div>
              </div>
            )}
          </div>

          <div className="composer">
            <button className="ghost-btn camera-btn" onClick={handleCameraOpen} disabled={cameraBusy} title="Show something via camera">
              <Camera size={17} strokeWidth={2} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={`Ask ${character.name} something…`}
            />
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isTyping} aria-label="Send">
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
      {showCameraModal && (
        <CameraCaptureModal onCapture={handleCameraCapture} onClose={() => setCameraModalOpen(false)} />
      )}
    </section>
  );
}
