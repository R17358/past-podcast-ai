import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import {
  createSubscriptionOrder,
  fetchSubscriptionStatus,
  loadRazorpayScript,
  verifySubscriptionPayment,
} from "../services/api.js";

function formatPaise(paise) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export default function SubscribeModal({ user, onClose, onSubscribed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null); // { price_paise, duration_days }

  useEffect(() => {
    fetchSubscriptionStatus()
      .then((s) => setPlan({ price_paise: s.price_paise, duration_days: s.duration_days }))
      .catch(() => setPlan({ price_paise: 19900, duration_days: 30 })); // sane fallback if status call fails
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    setError("");
    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        throw new Error("Could not load the payment widget — check your connection and try again.");
      }
      const order = await createSubscriptionOrder();

      const razorpay = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Hall of Sages",
        description: "Platform subscription — unlocks every subscription-tier sage",
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#7C5CFC" },
        handler: async (response) => {
          try {
            const status = await verifySubscriptionPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSubscribed(status);
          } catch (err) {
            setError(err?.response?.data?.detail || "Payment succeeded but verification failed — contact support.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      razorpay.on("payment.failed", () => {
        setError("Payment failed — please try again.");
        setLoading(false);
      });
      razorpay.open();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Could not start checkout — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="unlock-modal-head">
          <span className="auth-gate-icon"><Crown size={22} strokeWidth={1.75} /></span>
          <div>
            <h3>Hall of Sages subscription</h3>
            <p className="hint" style={{ margin: 0 }}>Unlocks every subscription-tier sage</p>
          </div>
        </div>
        <ul className="subscribe-benefits">
          <li>Unlimited access to all subscription-locked characters</li>
          <li>
            {plan ? `${formatPaise(plan.price_paise)} for ${plan.duration_days} days` : "…"}
            {" "}— cancel anytime, no auto-renewal
          </li>
          <li>Points-based unlocks still work independently — this is just a shortcut</li>
        </ul>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="ghost-btn" onClick={onClose}>Not now</button>
          <button className="primary-btn" onClick={handleSubscribe} disabled={loading}>
            {loading ? "Opening checkout…" : "Subscribe with Razorpay"}
          </button>
        </div>
      </div>
    </div>
  );
}
