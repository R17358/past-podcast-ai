from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.db import users_collection
from app.models.schemas import (
    Quiz,
    QuizCreateRequest,
    QuizGenerateRequest,
    QuizPublic,
    QuizQuestionPublic,
    QuizQuestionResult,
    QuizSubmitRequest,
    QuizSubmitResponse,
)
from app.services import auth_service, character_store, llm_service, quiz_store

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


def _to_public(quiz: Quiz, completed: bool) -> QuizPublic:
    return QuizPublic(
        id=quiz.id,
        title=quiz.title,
        character_id=quiz.character_id,
        category=quiz.category,
        created_by=quiz.created_by,
        questions=[QuizQuestionPublic(id=q.id, prompt=q.prompt, options=q.options) for q in quiz.questions],
        already_completed=completed,
    )


# --- Admin management (registered before the dynamic /{quiz_id} routes) ---

@router.get("/admin/all", response_model=list[Quiz])
def list_all_quizzes_admin(admin: dict = Depends(auth_service.require_admin)):
    """Full quiz documents (including correct answers) — admin quiz manager only."""
    return quiz_store.list_quizzes()


@router.post("", response_model=Quiz)
def create_quiz(payload: QuizCreateRequest, admin: dict = Depends(auth_service.require_admin)):
    quiz = quiz_store.create_quiz(
        title=payload.title,
        questions=[q.model_dump() for q in payload.questions],
        character_id=payload.character_id,
        category=payload.category,
        created_by="admin",
    )
    return quiz


@router.post("/generate", response_model=Quiz)
def generate_quiz(payload: QuizGenerateRequest, admin: dict = Depends(auth_service.require_admin)):
    """Admin-only: asks Gemini to draft a quiz, then saves it — same as a
    manually-created one from that point on (editable, deletable)."""
    character = None
    if payload.character_id:
        character = character_store.get_character(payload.character_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")

    topic = payload.topic_hint or (character.name if character else payload.category) or "general knowledge"
    try:
        questions = llm_service.generate_quiz_questions(
            topic=topic,
            character_name=character.name if character else None,
            num_questions=payload.num_questions,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate quiz: {exc}")

    title = f"{character.name} Quiz" if character else f"{payload.category or topic.title()} Quiz"
    return quiz_store.create_quiz(
        title=title,
        questions=questions,
        character_id=payload.character_id,
        category=payload.category,
        created_by="ai",
    )


# --- Everyday (any signed-in user) ---

@router.get("", response_model=list[QuizPublic])
def list_quizzes(
    character_id: Optional[str] = None,
    category: Optional[str] = None,
    user: dict = Depends(auth_service.get_current_user),
):
    quizzes = quiz_store.list_quizzes(character_id=character_id, category=category)
    user_id = str(user["_id"])
    return [_to_public(q, quiz_store.has_attempted(user_id, q.id)) for q in quizzes]


@router.get("/{quiz_id}", response_model=QuizPublic)
def get_quiz(quiz_id: str, user: dict = Depends(auth_service.get_current_user)):
    quiz = quiz_store.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return _to_public(quiz, quiz_store.has_attempted(str(user["_id"]), quiz.id))


@router.patch("/{quiz_id}", response_model=Quiz)
def edit_quiz(quiz_id: str, payload: QuizCreateRequest, admin: dict = Depends(auth_service.require_admin)):
    if not quiz_store.get_quiz(quiz_id):
        raise HTTPException(status_code=404, detail="Quiz not found")
    updated = quiz_store.update_quiz(
        quiz_id,
        title=payload.title,
        questions=[q.model_dump() for q in payload.questions],
        character_id=payload.character_id,
        category=payload.category,
    )
    return updated


@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: str, admin: dict = Depends(auth_service.require_admin)):
    if not quiz_store.delete_quiz(quiz_id):
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"deleted": True}


@router.post("/{quiz_id}/submit", response_model=QuizSubmitResponse)
def submit_quiz(quiz_id: str, payload: QuizSubmitRequest, user: dict = Depends(auth_service.get_current_user)):
    quiz = quiz_store.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if len(payload.answers) != len(quiz.questions):
        raise HTTPException(status_code=400, detail="Answer count doesn't match question count")

    results = []
    score = 0
    for question, selected in zip(quiz.questions, payload.answers):
        is_correct = selected == question.correct_index
        if is_correct:
            score += 1
        results.append(QuizQuestionResult(
            question_id=question.id,
            prompt=question.prompt,
            options=question.options,
            correct_index=question.correct_index,
            selected_index=selected,
            is_correct=is_correct,
            explanation=question.explanation,
        ))

    user_id = str(user["_id"])
    already = quiz_store.has_attempted(user_id, quiz_id)
    points_earned = 0
    if not already:
        points_earned = score * settings.POINTS_PER_CORRECT_ANSWER
        if points_earned:
            users_collection.update_one({"_id": user["_id"]}, {"$inc": {"points": points_earned}})
        quiz_store.record_attempt(user_id, quiz_id, score, len(quiz.questions))

    updated_user = users_collection.find_one({"_id": user["_id"]})
    return QuizSubmitResponse(
        quiz_id=quiz_id,
        score=score,
        total=len(quiz.questions),
        points_earned=points_earned,
        already_scored_before=already,
        total_points=updated_user.get("points", 0) if updated_user else user.get("points", 0),
        results=results,
    )
