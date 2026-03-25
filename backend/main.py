from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import upload, chat, flashcards, quiz, summary, documents, history, search

load_dotenv()

import logging
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Intelligent Study Assistant API",
    description="API for the Intelligent Study Assistant, providing PDF ingestion, semantic search, flashcards, and quizzes.",
    version="1.0.0"
)

# Configure CORS for React frontend
import os
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [
    frontend_url,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for maximum compatibility in this environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(summary.router, prefix="/api", tags=["Summary"])
app.include_router(flashcards.router, prefix="/api", tags=["Flashcards"])
app.include_router(quiz.router, prefix="/api", tags=["Quiz"])
app.include_router(history.router, prefix="/api", tags=["History"])
app.include_router(search.router, prefix="/api/search", tags=["Global Search"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Intelligent Study Assistant API. Go to /docs for the interactive API documentation."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
