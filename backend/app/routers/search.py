from fastapi import APIRouter, HTTPException
import logging
from app.models.schemas import SearchRequest, SearchResponse
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

@router.post("/global", response_model=SearchResponse)
async def global_search(request: SearchRequest):
    """Search across all documents."""
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Search query is required.")
    
    try:
        result = await llm_service.global_chat(SHARED_USER_ID, request.query)
        return SearchResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        logger.error(f"Global search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
