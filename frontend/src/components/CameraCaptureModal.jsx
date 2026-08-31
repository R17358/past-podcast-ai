import { useEffect, useRef, useState } from "react";
import { RefreshCw, Zap, ZapOff, X, Send } from "lucide-react";

export default function CameraCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment"); // back camera by default
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
const [question, setQuestion] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  async function startStream(mode) {
    stopStream();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const capabilities = track.getCapabilities?.() || {};
      setTorchSupported(!!capabilities.torch); // most browsers/devices DON'T support this — see note below
      setTorchOn(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setError("Couldn't access the camera — check browser/site permissions.");
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
  }

  async function toggleTorch() {
    if (!trackRef.current || !torchSupported) return;
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch {
      setError("Flash isn't controllable on this device/browser.");
    }
  }

  function switchCamera() {
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  }

 function handleCapture() {
  const video = videoRef.current;
  if (!video || !video.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  setCapturedImage(canvas.toDataURL("image/jpeg", 0.85));
  stopStream(); // camera off as soon as the frame is captured — no need to keep it running during review
}

function handleRetake() {
  setCapturedImage(null);
  setQuestion("");
  startStream(facingMode); // camera back on for another shot
}

function handleSend() {
  onCapture(capturedImage, question.trim() || undefined); // undefined -> backend's default question
}

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
  <div className="camera-modal-backdrop" onClick={handleClose}>
    <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
      {error ? (
        <p className="error-text">{error}</p>
      ) : capturedImage ? (
        <>
          <img src={capturedImage} alt="Captured" className="camera-preview" />
          <div className="camera-review-panel">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask something about this, or leave blank…`}
              autoFocus
            />
            <div className="camera-review-actions">
              <button className="ghost-btn" onClick={handleRetake}>Retake</button>
              <button className="send-btn" onClick={handleSend}>Send ➤</button>
            </div>
          </div>
        </>
      ) : (
        <video ref={videoRef} className="camera-preview" muted playsInline />
      )}

      {!capturedImage && (
        <div className="camera-controls">
          <button className="camera-icon-btn" onClick={switchCamera} title="Switch camera">
            <RefreshCw size={18} strokeWidth={2} />
          </button>
          <button className="camera-capture-btn" onClick={handleCapture} disabled={!!error} title="Capture">
            <span className="camera-capture-ring" />
          </button>
          <button
            className="camera-icon-btn"
            onClick={toggleTorch}
            disabled={!torchSupported}
            style={!torchSupported ? { opacity: 0.3 } : undefined}
            title={torchSupported ? "Toggle flash" : "Flash not supported on this device"}
          >
            {torchOn ? <Zap size={18} strokeWidth={2} /> : <ZapOff size={18} strokeWidth={2} />}
          </button>
        </div>
      )}
      <button className="camera-close-btn" onClick={handleClose} aria-label="Close camera">
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  </div>
);
}