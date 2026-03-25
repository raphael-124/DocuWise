from fastapi import APIRouter, HTTPException
import logging
from typing import Optional
from pydantic import BaseModel
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

class QuizScoreRequest(BaseModel):
    document_id: str
    score: int
    total: int

@router.post("/quiz/history")
def save_quiz_score(request: QuizScoreRequest):
    """Save a quiz score to history."""
    try:
        llm_service.save_quiz_score(request.document_id, request.score, request.total, SHARED_USER_ID)
        return {"message": "Score saved"}
    except Exception as e:
        logger.error(f"Error saving quiz score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quiz/history")
def get_quiz_history(document_id: Optional[str] = None):
    """Get quiz score history."""
    history = llm_service.get_quiz_history(SHARED_USER_ID, document_id)
    return {"history": history}
