"""
Quizzes + attempts live in their own MongoDB collections (see app/db.py).
Same pattern as character_store.py — everything else in the app only calls
the functions below, never touches the collections directly.
"""
import datetime
import uuid
from typing import List, Optional

from pymongo import ReturnDocument

from app.db import quiz_attempts_collection, quizzes_collection
from app.models.schemas import Quiz


def _to_quiz(doc: dict) -> Quiz:
    doc = {k: v for k, v in doc.items() if k != "_id"}
    return Quiz(**doc)


def _new_question_doc(q: dict) -> dict:
    return {
        "id": uuid.uuid4().hex[:8],
        "prompt": q["prompt"],
        "options": q["options"],
        "correct_index": q["correct_index"],
        "explanation": q.get("explanation"),
    }


def list_quizzes(character_id: Optional[str] = None, category: Optional[str] = None) -> List[Quiz]:
    query: dict = {}
    if character_id:
        query["character_id"] = character_id
    if category:
        query["category"] = category
    return [_to_quiz(doc) for doc in quizzes_collection.find(query)]


def get_quiz(quiz_id: str) -> Optional[Quiz]:
    doc = quizzes_collection.find_one({"id": quiz_id})
    return _to_quiz(doc) if doc else None


def create_quiz(title: str, questions: List[dict], character_id: Optional[str] = None,
                 category: Optional[str] = None, created_by: str = "admin") -> Quiz:
    doc = {
        "id": uuid.uuid4().hex[:10],
        "title": title,
        "character_id": character_id,
        "category": category,
        "created_by": created_by,
        "questions": [_new_question_doc(q) for q in questions],
    }
    quizzes_collection.insert_one(doc)
    return _to_quiz(doc)


def update_quiz(quiz_id: str, title: str, questions: List[dict],
                 character_id: Optional[str] = None, category: Optional[str] = None) -> Optional[Quiz]:
    result = quizzes_collection.find_one_and_update(
        {"id": quiz_id},
        {"$set": {
            "title": title,
            "character_id": character_id,
            "category": category,
            "questions": [_new_question_doc(q) for q in questions],
        }},
        return_document=ReturnDocument.AFTER,
    )
    return _to_quiz(result) if result else None


def delete_quiz(quiz_id: str) -> bool:
    quiz_attempts_collection.delete_many({"quiz_id": quiz_id})
    return quizzes_collection.delete_one({"id": quiz_id}).deleted_count > 0


def has_attempted(user_id: str, quiz_id: str) -> bool:
    return quiz_attempts_collection.find_one({"user_id": user_id, "quiz_id": quiz_id}) is not None


def record_attempt(user_id: str, quiz_id: str, score: int, total: int) -> None:
    """Best-effort insert — the unique (user_id, quiz_id) index means a
    concurrent double-submit can't award points twice even under a race."""
    try:
        quiz_attempts_collection.insert_one({
            "user_id": user_id,
            "quiz_id": quiz_id,
            "score": score,
            "total": total,
            "created_at": datetime.datetime.utcnow(),
        })
    except Exception:
        pass  # duplicate key -> someone else's concurrent request already recorded it
