# DocuWise 🧠✨

An AI-powered academic assistant that transforms your PDF documents into an interactive, gamified learning experience. Built with **FastAPI**, **React**, and **LangChain**.

---

## 🚀 Features (Optimized!)

- **⚡ Ultra-Fast Analysis**: Powered by **PyMuPDF** (10x faster extraction) and **Parallel Async Embedding**.
- **🛡️ Resilience**: Automatic fallback between Gemini versions and Local Local Embeddings (HuggingFace) if API limits are hit.
- **✨ Dynamic UI**: Premium dark mode design with "DocuWise" branding and real-time progress tracking.
- **💬 Q&A Chat**: Ask questions about your document with context-aware answers.
- **📚 AI Flashcards & Quizzes**: Automatically generate study materials from your text.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **Extraction**: PyMuPDF (fitz) - *Lightning fast*
- **Embeddings**: Google Gemini / HuggingFace (Local Fallback)
- **Vector Database**: FAISS

### Frontend
- **Framework**: React + Vite + TypeScript
- **Icons**: Lucide React
- **Animations**: Custom CSS Keyframes

---

## 💻 How to Run

### 1. One-Click Start (Recommended)
I've created a `start_app.cmd` (or you can run `python run_all.py`) in the root directory. This will start the Backend and Frontend together.

### 2. Manual Start

#### Backend
```bash
cd study-assistant/backend
python -m uvicorn main:app --reload
```
*Runs on [http://localhost:8000](http://localhost:8000)*

#### Frontend
```bash
cd study-assistant/frontend
npm run dev
```
*Runs on [http://localhost:5173](http://localhost:5173)*

---

## 🎨 Design & Speed
The application is now optimized for **extreme speed**. Most document analysis happens in parallel, and already-analyzed files will load **instantly** without reprocessing.
