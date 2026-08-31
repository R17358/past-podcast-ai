import { useState } from "react";
import { CheckCircle2, Coins, XCircle } from "lucide-react";
import { submitQuiz } from "../services/api.js";

export default function QuizPlayer({ quiz, onBack, onPointsAwarded }) {
  const [answers, setAnswers] = useState(() => Array(quiz.questions.length).fill(-1));
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const allAnswered = answers.every((a) => a >= 0);

  function selectAnswer(qIndex, optionIndex) {
    if (result) return; // locked after submit
    setAnswers((prev) => prev.map((a, i) => (i === qIndex ? optionIndex : a)));
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await submitQuiz(quiz.id, answers);
      setResult(data);
      if (data.points_earned > 0) onPointsAwarded(data.total_points);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="quiz-player">
      <button className="ghost-btn quiz-back-btn" onClick={onBack}>← Back to quizzes</button>
      <h3 className="quiz-title">{quiz.title}</h3>

      {result && (
        <div className="quiz-result-banner">
          <p className="quiz-score">
            {result.score} / {result.total} correct
          </p>
          {result.points_earned > 0 ? (
            <p className="quiz-points-earned">
              <Coins size={15} strokeWidth={2} /> +{result.points_earned} points earned
            </p>
          ) : result.already_scored_before ? (
            <p className="hint">You've already earned points for this quiz — this was just for practice.</p>
          ) : (
            <p className="hint">No points this time — review the explanations below and try another quiz!</p>
          )}
        </div>
      )}

      <div className="quiz-questions">
        {quiz.questions.map((q, qi) => {
          const questionResult = result?.results?.[qi];
          return (
            <div key={q.id} className="quiz-question-card">
              <p className="quiz-question-prompt">{qi + 1}. {q.prompt}</p>
              <div className="quiz-options">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  let stateClass = "";
                  if (questionResult) {
                    if (oi === questionResult.correct_index) stateClass = "correct";
                    else if (selected && !questionResult.is_correct) stateClass = "incorrect";
                  } else if (selected) {
                    stateClass = "selected";
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      className={`quiz-option ${stateClass}`}
                      onClick={() => selectAnswer(qi, oi)}
                      disabled={!!result}
                    >
                      {questionResult && oi === questionResult.correct_index && (
                        <CheckCircle2 size={15} strokeWidth={2} />
                      )}
                      {questionResult && selected && !questionResult.is_correct && oi !== questionResult.correct_index && (
                        <XCircle size={15} strokeWidth={2} />
                      )}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {questionResult?.explanation && (
                <p className="quiz-explanation">{questionResult.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="error-text">{error}</p>}

      {!result && (
        <div className="modal-actions">
          <button className="primary-btn" onClick={handleSubmit} disabled={!allAnswered || submitting}>
            {submitting ? "Submitting…" : "Submit answers"}
          </button>
        </div>
      )}
    </div>
  );
}
