from fastapi import APIRouter
import logging
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

SHARED_USER_ID = 1

@router.get("/documents")
def list_documents():
    """List all previously uploaded documents."""
    docs = llm_service.get_documents(SHARED_USER_ID)
    return {"documents": docs}

@router.delete("/documents/{document_id}")
def delete_document(document_id: str):
    """Delete a single document."""
    llm_service.delete_document(document_id, SHARED_USER_ID)
    return {"message": f"Document {document_id} deleted"}

@router.delete("/documents")
def delete_all_documents():
    """Delete all documents."""
    llm_service.delete_all_documents(SHARED_USER_ID)
    return {"message": "All documents deleted"}
