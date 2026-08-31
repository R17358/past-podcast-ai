import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, X } from "lucide-react";
import { fetchQuiz, fetchQuizzes } from "../services/api.js";
import QuizPlayer from "./QuizPlayer.jsx";

export default function QuizListModal({ characters, onClose, onPointsAwarded }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeQuiz, setActiveQuiz] = useState(null);

  useEffect(() => {
    fetchQuizzes()
      .then(setQuizzes)
      .catch(() => setError("Could not load quizzes right now."))
      .finally(() => setLoading(false));
  }, []);

  async function openQuiz(quizId) {
    setError("");
    try {
      const quiz = await fetchQuiz(quizId);
      setActiveQuiz(quiz);
    } catch {
      setError("Could not load this quiz — please try again.");
    }
  }

  function characterName(characterId) {
    return characters.find((c) => c.id === characterId)?.name;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal quiz-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>

        {activeQuiz ? (
          <QuizPlayer
            quiz={activeQuiz}
            onBack={() => setActiveQuiz(null)}
            onPointsAwarded={onPointsAwarded}
          />
        ) : (
          <>
            <h3>Quizzes</h3>
            <p className="hint">Answer correctly to earn points — spend them unlocking characters.</p>

            {loading && <p className="hint">Loading quizzes…</p>}
            {error && <p className="error-text">{error}</p>}
            {!loading && quizzes.length === 0 && !error && (
              <p className="hint">No quizzes yet — check back soon.</p>
            )}

            <div className="quiz-list">
              {quizzes.map((q) => (
                <button key={q.id} className="quiz-list-item" onClick={() => openQuiz(q.id)}>
                  <span className="quiz-list-icon">
                    <ClipboardList size={16} strokeWidth={2} />
                  </span>
                  <span className="quiz-list-info">
                    <span className="quiz-list-title">{q.title}</span>
                    <span className="quiz-list-meta">
                      {q.questions.length} questions
                      {q.character_id ? ` · ${characterName(q.character_id) || "character"}` : ""}
                      {q.category ? ` · ${q.category}` : ""}
                    </span>
                  </span>
                  {q.already_completed && (
                    <span className="quiz-list-done" title="Already completed">
                      <CheckCircle2 size={16} strokeWidth={2} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
