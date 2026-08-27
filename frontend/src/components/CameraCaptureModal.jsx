import { useEffect, useRef, useState } from "react";

export default function CameraCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment"); // back camera by default
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
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
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    onCapture(imageBase64);
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
        ) : (
          <video ref={videoRef} className="camera-preview" muted playsInline />
        )}
        <div className="camera-controls">
          <button className="camera-icon-btn" onClick={switchCamera} title="Switch camera">🔄</button>
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
            {torchOn ? "⚡" : "🔦"}
          </button>
        </div>
        <button className="camera-close-btn" onClick={handleClose}>✕</button>
      </div>
    </div>
  );
}