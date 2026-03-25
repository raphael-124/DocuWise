from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import logging
from app.models.schemas import SearchRequest, ChatHistoryResponse, ChatMessage
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

@router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(document_id: str):
    """Retrieve chat history for a document."""
    if not document_id or not document_id.strip():
        raise HTTPException(status_code=400, detail="document_id is required.")
    
    history_data = llm_service.get_chat_history(SHARED_USER_ID, document_id)
    history = [ChatMessage(**msg) for msg in history_data]
    return ChatHistoryResponse(history=history)

@router.post("/chat")
async def chat_with_document(document_id: str, request: SearchRequest):
    if not document_id or not document_id.strip():
        raise HTTPException(status_code=400, detail="document_id is required.")
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    try:
        logger.info(f"Chat request for doc={document_id}, query='{request.query[:50]}...'")
        return StreamingResponse(
            llm_service.astream_chat(SHARED_USER_ID, document_id, request.query),
            media_type="text/event-stream"
        )
    except ValueError as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
