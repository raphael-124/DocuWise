from fastapi import APIRouter, File, UploadFile, HTTPException
import os
import logging
import shutil
from app.services.document_processor import document_processor
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Temporary upload folder
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE_MB = 20
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt", ".md"}

SHARED_USER_ID = 1

@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    ai_provider: str = "gemini",
):
    # Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Please upload: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Check file size
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large ({file_size_mb:.1f}MB). Maximum allowed is {MAX_FILE_SIZE_MB}MB."
        )
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    
    logger.info(f"Uploaded file: {file.filename} ({file_size_mb:.1f}MB) using provider: {ai_provider}")
        
    try:
        # Create a unique document ID based on the filename and provider
        base_name = file.filename
        if ai_provider == "ollama":
            doc_id = f"{base_name}_local"
        elif ai_provider == "huggingface":
            doc_id = f"{base_name}_hf"
        else:
            doc_id = base_name
            
        logger.info(f"Processing document start: {doc_id} for user {SHARED_USER_ID}")
        
        # Use our new parallel async processor for extreme speed
        num_chunks = await document_processor.aprocess_and_store_document(
            file_path, doc_id, file.filename
        )
        
        logger.info(f"Document processed into {num_chunks} chunks. Saving info...")
        llm_service.save_document_info(doc_id, file.filename, num_chunks, SHARED_USER_ID)
        
        return {
            "message": f"Successfully uploaded and processed {file.filename}", 
            "filename": file.filename,
            "document_id": doc_id,
            "chunks_created": num_chunks,
            "provider": ai_provider
        }
    except ValueError as e:
        logger.error(f"Value Error during processing: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"Processing Error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error processing {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")
