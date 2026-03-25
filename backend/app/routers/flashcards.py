from fastapi import APIRouter, HTTPException
import logging
from app.models.schemas import FlashcardResponse, Flashcard
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

@router.post("/flashcards/generate", response_model=FlashcardResponse)
async def generate_flashcards(document_id: str, num_cards: int = 5):
    if not document_id or not document_id.strip():
        raise HTTPException(status_code=400, detail="document_id is required.")
    if num_cards < 1 or num_cards > 20:
        raise HTTPException(status_code=400, detail="num_cards must be between 1 and 20.")
    
    try:
        logger.info(f"Generating {num_cards} flashcards for doc={document_id}")
        flashcards_data = await llm_service.generate_flashcards(SHARED_USER_ID, document_id, num_cards)
        flashcards = [Flashcard(**fc) for fc in flashcards_data if "question" in fc and "answer" in fc]
        logger.info(f"Generated {len(flashcards)} flashcards successfully")
        return FlashcardResponse(flashcards=flashcards)
    except ValueError as e:
        logger.error(f"Flashcard generation error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected flashcard error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate flashcards: {str(e)}")
