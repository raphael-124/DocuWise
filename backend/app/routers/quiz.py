from fastapi import APIRouter, HTTPException
import logging
from app.models.schemas import QuizResponse, QuizQuestion, QuestionOption
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

@router.post("/quiz/generate", response_model=QuizResponse)
async def generate_quiz(document_id: str, num_questions: int = 3):
    if not document_id or not document_id.strip():
        raise HTTPException(status_code=400, detail="document_id is required.")
    if num_questions < 1 or num_questions > 15:
        raise HTTPException(status_code=400, detail="num_questions must be between 1 and 15.")
    
    try:
        logger.info(f"Generating {num_questions}-question quiz for doc={document_id}")
        quiz_data = await llm_service.generate_quiz(SHARED_USER_ID, document_id, num_questions)
        questions = []
        for q in quiz_data:
            if "question" in q and "options" in q and "explanation" in q:
                options = [QuestionOption(**opt) for opt in q["options"]]
                questions.append(QuizQuestion(
                    question=q["question"],
                    options=options,
                    explanation=q["explanation"]
                ))
        logger.info(f"Generated {len(questions)} quiz questions successfully")
        return QuizResponse(questions=questions)
    except ValueError as e:
        logger.error(f"Quiz generation error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected quiz error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")
