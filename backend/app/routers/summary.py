from fastapi import APIRouter, HTTPException
import logging
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

@router.post("/summary")
async def generate_summary(document_id: str):
    if not document_id or not document_id.strip():
        raise HTTPException(status_code=400, detail="document_id is required.")
    
    try:
        logger.info(f"Generating summary for doc={document_id}")
        summary = await llm_service.generate_summary(SHARED_USER_ID, document_id)
        return {"summary": summary}
    except ValueError as e:
        logger.error(f"Summary error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")
