import { useState } from "react";
import {
  Landmark, Search, Phone, ListChecks, Sparkles, Crown, ShieldCheck, ArrowRight, ArrowLeft, X,
} from "lucide-react";

const TOUR_SEEN_KEY = "hos-tour-seen-v1";

export function hasSeenTour() {
  return localStorage.getItem(TOUR_SEEN_KEY) === "1";
}

export function markTourSeen() {
  localStorage.setItem(TOUR_SEEN_KEY, "1");
}

function buildSteps(isAdmin) {
  const steps = [
    {
      icon: Landmark,
      title: "Welcome to Hall of Sages",
      body: "Chat — by text or live voice call — with historical and mythological figures, brought to life by AI. Ask them anything, in your own language.",
    },
    {
      icon: Search,
      title: "Find a sage",
      body: "Search by name or topic, or filter by category (Science, Philosophy, Anime, and more) using the chips at the top of the list.",
    },
    {
      icon: Phone,
      title: "Chat or Call",
      body: "Switch between text chat and a live voice call using the slider in the chat header. In a call, tap the mic to interrupt and talk, or mute the speaker without hanging up.",
    },
    {
      icon: Sparkles,
      title: "Customize how they reply",
      body: "The sparkle icon in the chat header lets you pick reply length (short/normal/detailed) and tone (normal/professional/funny/friendly) for that character.",
    },
    {
      icon: ListChecks,
      title: "Earn points with quizzes",
      body: "Hit \"Quizzes\" in the sidebar to test your knowledge. Correct answers earn points — spend them to unlock points-locked characters.",
    },
    {
      icon: Crown,
      title: "Or subscribe",
      body: "Some characters need a subscription instead of points. One subscription unlocks every subscription-tier character at once — no rush, points-based unlocking always works too.",
    },
  ];
  if (isAdmin) {
    steps.push({
      icon: ShieldCheck,
      title: "You're an admin",
      body: "You can add and edit characters (set their category, unlock rules, voice and photo), and write or AI-generate quizzes from the gear icon next to your profile.",
    });
  }
  return steps;
}

export default function OnboardingTour({ isAdmin, onClose }) {
  const steps = buildSteps(isAdmin);
  const [index, setIndex] = useState(0);
  const isLast = index === steps.length - 1;
  const step = steps[index];
  const Icon = step.icon;

  function finish() {
    markTourSeen();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={finish}>
      <div className="modal tour-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={finish} aria-label="Close tour">
          <X size={16} strokeWidth={2} />
        </button>

        <div className="tour-icon">
          <Icon size={26} strokeWidth={1.75} />
        </div>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>

        <div className="tour-dots">
          {steps.map((_, i) => (
            <span key={i} className={`tour-dot ${i === index ? "active" : ""}`} />
          ))}
        </div>

        <div className="modal-actions tour-actions">
          {index > 0 ? (
            <button className="ghost-btn" onClick={() => setIndex((i) => i - 1)}>
              <ArrowLeft size={14} strokeWidth={2} /> Back
            </button>
          ) : (
            <button className="ghost-btn" onClick={finish}>Skip</button>
          )}
          {isLast ? (
            <button className="primary-btn" onClick={finish}>Let's go</button>
          ) : (
            <button className="primary-btn" onClick={() => setIndex((i) => i + 1)}>
              Next <ArrowRight size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
