import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import {
  createQuiz,
  deleteQuiz,
  editQuiz,
  fetchAllQuizzesAdmin,
  generateQuiz,
} from "../services/api.js";

const BLANK_QUESTION = () => ({ prompt: "", options: ["", "", "", ""], correct_index: 0, explanation: "" });

export default function AdminQuizModal({ characters, categories, onClose }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // "list" | "manual" | "generate"
  const [editingId, setEditingId] = useState(null);

  // Manual form state
  const [title, setTitle] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [category, setCategory] = useState("");
  const [questions, setQuestions] = useState([BLANK_QUESTION()]);
  const [saving, setSaving] = useState(false);

  // AI-generate form state
  const [genCharacterId, setGenCharacterId] = useState("");
  const [genCategory, setGenCategory] = useState("");
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  function refresh() {
    setLoading(true);
    fetchAllQuizzesAdmin()
      .then(setQuizzes)
      .catch(() => setError("Could not load quizzes."))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function resetManualForm() {
    setTitle("");
    setCharacterId("");
    setCategory("");
    setQuestions([BLANK_QUESTION()]);
    setEditingId(null);
  }

  function startEdit(quiz) {
    setTitle(quiz.title);
    setCharacterId(quiz.character_id || "");
    setCategory(quiz.category || "");
    setQuestions(quiz.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation || "",
    })));
    setEditingId(quiz.id);
    setView("manual");
  }

  function updateQuestion(index, patch) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex, oIndex, value) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const options = q.options.map((o, oi) => (oi === oIndex ? value : o));
      return { ...q, options };
    }));
  }

  async function handleManualSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        character_id: characterId || null,
        category: category || null,
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          correct_index: q.correct_index,
          explanation: q.explanation?.trim() || null,
        })),
      };
      if (editingId) {
        await editQuiz(editingId, payload);
      } else {
        await createQuiz(payload);
      }
      resetManualForm();
      setView("list");
      refresh();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save this quiz.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");
    setGenerating(true);
    try {
      await generateQuiz({
        character_id: genCharacterId || null,
        category: genCategory || null,
        topic_hint: genTopic.trim() || null,
        num_questions: Number(genCount) || 5,
      });
      setGenCharacterId("");
      setGenCategory("");
      setGenTopic("");
      setView("list");
      refresh();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not generate this quiz — try again or write it manually.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(quizId) {
    setError("");
    try {
      await deleteQuiz(quizId);
      refresh();
    } catch {
      setError("Could not delete this quiz.");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal admin-quiz-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>
        <h3>Manage quizzes</h3>

        <div className="admin-tabs">
          <button className={`admin-tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
            All quizzes
          </button>
          <button
            className={`admin-tab ${view === "manual" ? "active" : ""}`}
            onClick={() => { resetManualForm(); setView("manual"); }}
          >
            <Plus size={13} strokeWidth={2} /> Write manually
          </button>
          <button className={`admin-tab ${view === "generate" ? "active" : ""}`} onClick={() => setView("generate")}>
            <Sparkles size={13} strokeWidth={2} /> AI generate
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {view === "list" && (
          <div className="quiz-list">
            {loading && <p className="hint">Loading…</p>}
            {!loading && quizzes.length === 0 && <p className="hint">No quizzes yet.</p>}
            {quizzes.map((q) => (
              <div key={q.id} className="quiz-list-item admin-quiz-row">
                <span className="quiz-list-info">
                  <span className="quiz-list-title">
                    {q.title} {q.created_by === "ai" && <span className="ai-badge">AI</span>}
                  </span>
                  <span className="quiz-list-meta">{q.questions.length} questions</span>
                </span>
                <button className="ghost-btn" onClick={() => startEdit(q)}>Edit</button>
                <button className="icon-btn" onClick={() => handleDelete(q.id)} title="Delete quiz">
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}

        {view === "manual" && (
          <form onSubmit={handleManualSave} className="admin-quiz-form">
            <div className="field">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Character (optional)</label>
                <select value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
                  <option value="">None</option>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Category (optional)</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Science" list="admin-quiz-categories" />
                <datalist id="admin-quiz-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="admin-question-card">
                <div className="admin-question-head">
                  <span>Question {qi + 1}</span>
                  {questions.length > 1 && (
                    <button type="button" className="icon-btn" onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}>
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>
                <input
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                  placeholder="Question text"
                  required
                />
                {q.options.map((opt, oi) => (
                  <label key={oi} className="admin-option-row">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_index === oi}
                      onChange={() => updateQuestion(qi, { correct_index: oi })}
                    />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      required
                    />
                  </label>
                ))}
                <input
                  value={q.explanation}
                  onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                  placeholder="Explanation (optional)"
                />
              </div>
            ))}

            <button type="button" className="ghost-btn" onClick={() => setQuestions((prev) => [...prev, BLANK_QUESTION()])}>
              <Plus size={14} strokeWidth={2} /> Add question
            </button>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => { resetManualForm(); setView("list"); }}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create quiz"}
              </button>
            </div>
          </form>
        )}

        {view === "generate" && (
          <form onSubmit={handleGenerate} className="admin-quiz-form">
            <p className="hint">Gemini will draft the questions — you can edit them afterwards from "All quizzes".</p>
            <div className="field-row">
              <div className="field">
                <label>Character (optional)</label>
                <select value={genCharacterId} onChange={(e) => setGenCharacterId(e.target.value)}>
                  <option value="">None</option>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Category (optional)</label>
                <input value={genCategory} onChange={(e) => setGenCategory(e.target.value)} placeholder="e.g. Anime" list="admin-quiz-categories" />
              </div>
            </div>
            <div className="field">
              <label>Topic hint (optional)</label>
              <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)} placeholder="e.g. Newton's laws of motion" />
            </div>
            <div className="field">
              <label>Number of questions</label>
              <input type="number" min={1} max={15} value={genCount} onChange={(e) => setGenCount(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setView("list")}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={generating}>
                {generating ? "Generating…" : "Generate quiz"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
