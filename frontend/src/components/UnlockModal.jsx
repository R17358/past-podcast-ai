import { useState } from "react";
import { Coins, Crown, Lock } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { unlockCharacter } from "../services/api.js";

export default function UnlockModal({ character, user, onClose, onUnlocked, onOpenSubscribe }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPoints = character.access_type === "points";
  const isSubscription = character.access_type === "subscription";
  const points = user?.points ?? 0;
  const canAffordPoints = isPoints && points >= character.unlock_points;

  async function handleUnlockWithPoints() {
    setLoading(true);
    setError("");
    try {
      const updated = await unlockCharacter(character.id);
      onUnlocked(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not unlock this character — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal unlock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="unlock-modal-head">
          <Avatar url={character.avatar_url} emoji={character.avatar_emoji} size={64} />
          <div>
            <h3>{character.name}</h3>
            <p className="hint" style={{ margin: 0 }}>{character.title}</p>
          </div>
        </div>

        <div className="unlock-reason">
          <Lock size={16} strokeWidth={2} />
          {isPoints ? (
            <span>Unlock this sage for <strong>{character.unlock_points} points</strong>.</span>
          ) : (
            <span>This sage is available with an active <strong>subscription</strong>.</span>
          )}
        </div>

        {isPoints && (
          <>
            <div className="points-balance-row">
              <Coins size={15} strokeWidth={2} />
              <span>Your balance: <strong>{points} points</strong></span>
            </div>
            {!canAffordPoints && (
              <p className="hint">
                Not enough points yet — play a quiz to earn more, or subscribe to unlock every
                subscription-tier character instantly.
              </p>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="ghost-btn" onClick={onClose}>Cancel</button>
              <button
                className="primary-btn"
                onClick={handleUnlockWithPoints}
                disabled={loading || !canAffordPoints}
              >
                {loading ? "Unlocking…" : `Unlock for ${character.unlock_points} pts`}
              </button>
            </div>
            <button className="ghost-btn unlock-alt-btn" onClick={onOpenSubscribe}>
              <Crown size={14} strokeWidth={2} /> Or get the subscription instead
            </button>
          </>
        )}

        {isSubscription && (
          <>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="ghost-btn" onClick={onClose}>Cancel</button>
              <button className="primary-btn" onClick={onOpenSubscribe}>
                <Crown size={14} strokeWidth={2} /> Get subscription
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
