import os
import json
import time
import asyncio
import logging
from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import sqlite3
from app.services.db import DB_PATH

logger = logging.getLogger(__name__)

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)
VECTOR_STORE_DIR = os.path.join(DATA_DIR, "vectorstore")
HISTORY_FILE = os.path.join(DATA_DIR, "quiz_history.json")
DOCUMENTS_FILE = os.path.join(DATA_DIR, "documents.json")

STUDY_SYSTEM_PROMPT = (
    "You are an academic study assistant. Use the following pieces of retrieved "
    "context to answer the question. If you don't know the answer, say that you don't know. "
    "Keep the answer concise and strictly related to the provided context.\n\n"
    "Context:\n{context}"
)

class LLMService:
    def __init__(self):
        self._cloud_llm = None
        self._cloud_embeddings = None
        self._vectorstore_cache = {}
        self._merged_vs_cache = None
        self._merged_id_list = []
        # Concurrency lock to prevent simultaneous heavy API calls on free tier
        self._api_lock = asyncio.Semaphore(1)

    def verify_document_ownership(self, user_id: int, document_id: str):
        """Verify that the given user_id owns the document_id."""
        docs = self._load_json(DOCUMENTS_FILE, [])
        is_owner = any(d["document_id"] == document_id and d.get("user_id") == user_id for d in docs)
        if not is_owner:
            logger.warning(f"Unauthorized access attempt: User {user_id} tried to access doc {document_id}")
            raise ValueError(f"Unauthorized: You do not have access to document '{document_id}'.")

    def _get_llm(self, use_local: bool = False, fallback: bool = False):
        if use_local:
            try:
                from langchain_ollama import ChatOllama
                return ChatOllama(model="llama3.2", temperature=0.7)
            except ImportError:
                logger.warning("langchain-ollama not installed, using cloud LLM")
        
        if self._cloud_llm is None or fallback:
            api_key = os.getenv("GOOGLE_API_KEY")
            # Using the confirmed functional model for this API key: gemini-2.5-flash
            model_name = "models/gemini-1.5-pro" if fallback else "models/gemini-2.5-flash"
            logger.info(f"Initializing Cloud LLM: {model_name}")
            
            llm = ChatGoogleGenerativeAI(
                model=model_name, temperature=0.7, google_api_key=api_key
            )
            if not fallback:
                self._cloud_llm = llm
            return llm
            
        return self._cloud_llm

    def _get_embeddings(self, use_local: bool = False, provider: str = "gemini"):
        if provider == "ollama":
            try:
                from langchain_ollama import OllamaEmbeddings
                return OllamaEmbeddings(model="nomic-embed-text")
            except ImportError:
                logger.warning("langchain-ollama not installed, using cloud embeddings")
        elif provider == "huggingface":
            try:
                from langchain_huggingface import HuggingFaceEmbeddings
                return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
            except ImportError:
                logger.warning("langchain-huggingface not installed, using cloud embeddings")
        
        if self._cloud_embeddings is None:
            api_key = os.getenv("GOOGLE_API_KEY")
            self._cloud_embeddings = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001", google_api_key=api_key
            )
        return self._cloud_embeddings

    def _get_retriever(self, document_id: str, use_local: bool = False):
        """Load (or return cached) the vectorstore retriever for the given document_id."""
        provider = "gemini"
        if document_id.endswith("_local"):
            provider = "ollama"
        elif document_id.endswith("_hf"):
            provider = "huggingface"

        if document_id in self._vectorstore_cache:
            logger.info(f"Vectorstore cache HIT for {document_id}")
            vectorstore = self._vectorstore_cache[document_id]
        else:
            logger.info(f"Vectorstore cache MISS for {document_id}. Loading from disk...")
            full_path = os.path.join(VECTOR_STORE_DIR, document_id)
            if not os.path.exists(full_path):
                raise ValueError(f"Vector store for document '{document_id}' not found at {full_path}.")

            embeddings = self._get_embeddings(provider=provider)
            vectorstore = FAISS.load_local(full_path, embeddings, allow_dangerous_deserialization=True)
            self._vectorstore_cache[document_id] = vectorstore

        return vectorstore.as_retriever(search_kwargs={"k": 3})

    def _format_docs(self, docs):
        return "\n\n".join(doc.page_content for doc in docs)

    async def _invoke_with_retry(self, llm, prompt, max_retries=6):
        """Invoke LLM with automatic retry on rate limits and concurrency control."""
        async with self._api_lock:
            for attempt in range(max_retries):
                try:
                    return await llm.ainvoke(prompt)
                except Exception as e:
                    error_str = str(e).lower()
                    
                    # Handle 404/Not Found by trying fallback models
                    if ("404" in error_str or "not_found" in error_str):
                        if attempt == 0:
                            logger.warning(f"Primary model not found (404). Attempting fallback to models/gemini-1.5-pro...")
                            fallback_llm = self._get_llm(fallback=True)
                            return await fallback_llm.ainvoke(prompt)
                        elif attempt == 1:
                            # Final-final fallback to the old but stable gemini-pro
                            logger.warning(f"Fallback model failed (404). Trying original models/gemini-pro...")
                            api_key = os.getenv("GOOGLE_API_KEY")
                            final_llm = ChatGoogleGenerativeAI(model="models/gemini-pro", temperature=0.7, google_api_key=api_key)
                            return await final_llm.ainvoke(prompt)

                    if ("429" in error_str or "resource" in error_str or "quota" in error_str) and attempt < max_retries - 1:
                        # Exponential backoff: 5, 10, 20, 30, 45, 60s
                        wait_times = [5, 10, 20, 30, 45, 60]
                        wait_time = wait_times[attempt] if attempt < len(wait_times) else 60
                        logger.warning(f"LLM rate limited (429/Resource Exhausted). Waiting {wait_time}s (attempt {attempt+1}/{max_retries}). Error: {str(e)[:100]}...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"LLM invocation failed permanently after {attempt + 1} attempts: {str(e)}")
                        raise

    async def chat(self, user_id: int, document_id: str, query: str):
        self.verify_document_ownership(user_id, document_id)
        # Infer use_local for LLM selection based on doc_id suffix
        use_local_llm = document_id.endswith("_local")
        retriever = self._get_retriever(document_id)
        llm = self._get_llm(use_local_llm)

        prompt = ChatPromptTemplate.from_messages([
            ("system", STUDY_SYSTEM_PROMPT),
            ("human", "{question}"),
        ])

        docs = await retriever.ainvoke(query)
        # Truncate context for free tier chat stability
        context = self._format_docs(docs)[:3000]

        chain = prompt | llm | StrOutputParser()
        answer = await self._invoke_with_retry(llm, prompt.format(context=context, question=query))
        
        # Final answer is a string from invoke with retry
        if hasattr(answer, "content"):
            answer_text = answer.content
        else:
            answer_text = str(answer)

        # Save to DB
        self.save_chat_message(user_id, document_id, "user", query)
        self.save_chat_message(user_id, document_id, "assistant", answer_text)

        return {
            "answer": answer_text,
            "sources": [doc.page_content[:200] + "..." for doc in docs]
        }

    async def astream_chat(self, user_id: int, document_id: str, query: str):
        self.verify_document_ownership(user_id, document_id)
        # Infer use_local for LLM selection
        use_local_llm = document_id.endswith("_local")
        retriever = self._get_retriever(document_id)
        llm = self._get_llm(use_local_llm)

        prompt = ChatPromptTemplate.from_messages([
            ("system", STUDY_SYSTEM_PROMPT),
            ("human", "{question}"),
        ])

        docs = await retriever.ainvoke(query)
        # Truncate context for free tier chat stability
        context = self._format_docs(docs)[:3000]
        sources = [doc.page_content[:200] + "..." for doc in docs]
        yield f"data: {json.dumps({'sources': sources})}\n\n"
        try:
            # Save user message first
            self.save_chat_message(user_id, document_id, "user", query)
            
            chain = prompt | llm | StrOutputParser()
            full_response = ""
            
            # Streaming retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    async for chunk in chain.astream({"context": context, "question": query}):
                        if chunk:
                            full_response += chunk
                            yield f"data: {json.dumps({'text': chunk})}\n\n"
                    # If success, break the retry loop
                    break
                except Exception as e:
                    # ... retry logic ...
                    err_msg = str(e).lower()
                    
                    # Handle 404 in streaming
                    if ("404" in err_msg or "not_found" in err_msg):
                        if attempt == 0:
                            logger.warning(f"Streaming: Primary model not found (404). Trying models/gemini-1.5-pro...")
                            llm = self._get_llm(fallback=True)
                            chain = prompt | llm | StrOutputParser()
                            continue
                        elif attempt == 1:
                            logger.warning(f"Streaming: Fallback failed. Trying original models/gemini-pro...")
                            api_key = os.getenv("GOOGLE_API_KEY")
                            llm = ChatGoogleGenerativeAI(model="models/gemini-pro", temperature=0.7, google_api_key=api_key)
                            chain = prompt | llm | StrOutputParser()
                            continue

                    if ("429" in err_msg or "resource" in err_msg or "quota" in err_msg) and attempt < max_retries - 1:
                        wait_time = 5 * (attempt + 1)
                        logger.warning(f"Streaming chat rate limited. Retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                        yield f"data: {json.dumps({'text': f'\n\n[Rate limit reached, retrying in {wait_time}s...]\n\n'})}\n\n"
                        await asyncio.sleep(wait_time)
                    else:
                        raise e
            
            # Save assistant message
            if full_response:
                self.save_chat_message(user_id, document_id, "assistant", full_response)
        except Exception as e:
            err_msg = str(e)
            if "quota" in err_msg.lower() or "429" in err_msg.lower():
                msg = "⚠️ AI Rate Limit Reached. Please wait a moment and try again, or switch to Ollama Local in the settings."
            else:
                msg = f"⚠️ Chat Error: {err_msg[:100]}"
            yield f"data: {json.dumps({'text': msg})}\n\n"
            logger.error(f"Streaming chat failed: {err_msg}")

        yield "data: [DONE]\n\n"

    async def generate_flashcards(self, user_id: int, document_id: str, num_cards: int = 5):
        self.verify_document_ownership(user_id, document_id)
        use_local_llm = document_id.endswith("_local")
        retriever = self._get_retriever(document_id)
        # Use minimal context to avoid rate limits
        retriever.search_kwargs["k"] = 1
        llm = self._get_llm(use_local_llm)
        docs = await retriever.ainvoke("key concepts definitions important facts")
        # Extreme truncation for Free Tier
        context = self._format_docs(docs)[:2500]

        prompt = f"""You are a study flashcard generator. Create exactly {num_cards} high-quality flashcards from this text.
Rules:
- Each question should test understanding of a KEY concept, definition, or fact
- Answers should be clear and concise (1-3 sentences)
- Cover different topics from the text
- Output ONLY a JSON array, no markdown, no explanation

Format: [{{"question": "...", "answer": "..."}}]

Text:
{context}"""
        response = await self._invoke_with_retry(llm, prompt)
        text_content = response.content.strip()

        if text_content.startswith("```json"):
            text_content = text_content[7:]
        if text_content.startswith("```"):
            text_content = text_content[3:]
        if text_content.endswith("```"):
            text_content = text_content[:-3]

        try:
            return json.loads(text_content.strip())
        except json.JSONDecodeError:
            logger.error(f"Failed to parse flashcard JSON: {text_content[:200]}")
            return [{"question": "Error generating flashcards", "answer": "Could not parse LLM output. Please try again."}]

    async def generate_quiz(self, user_id: int, document_id: str, num_questions: int = 5):
        self.verify_document_ownership(user_id, document_id)
        use_local_llm = document_id.endswith("_local")
        retriever = self._get_retriever(document_id)
        retriever.search_kwargs["k"] = 1
        llm = self._get_llm(use_local_llm)
        docs = await retriever.ainvoke("important facts definitions concepts for quiz")
        context = self._format_docs(docs)[:2500]

        prompt = f"""You are a quiz generator. Create exactly {num_questions} multiple-choice questions from this text.
Rules:
- Each question has exactly 4 options, only ONE is correct
- Questions should test real understanding, not trivial details
- Include a brief explanation for each correct answer
- Output ONLY a JSON array, no markdown, no explanation

Format: [{{"question": "...", "options": [{{"text": "...", "is_correct": true}}, {{"text": "...", "is_correct": false}}, {{"text": "...", "is_correct": false}}, {{"text": "...", "is_correct": false}}], "explanation": "..."}}]

Text:
{context}"""
        response = await self._invoke_with_retry(llm, prompt)
        text_content = response.content.strip()

        if text_content.startswith("```json"):
            text_content = text_content[7:]
        if text_content.startswith("```"):
            text_content = text_content[3:]
        if text_content.endswith("```"):
            text_content = text_content[:-3]

        try:
            return json.loads(text_content.strip())
        except json.JSONDecodeError:
            logger.error(f"Failed to parse quiz JSON: {text_content[:200]}")
            return []

    async def generate_summary(self, user_id: int, document_id: str):
        """Generate a concise summary of the document."""
        self.verify_document_ownership(user_id, document_id)
        use_local_llm = document_id.endswith("_local")
        retriever = self._get_retriever(document_id)
        # Extreme k=1 truncation for summary to avoid 429
        retriever.search_kwargs["k"] = 1
        llm = self._get_llm(use_local_llm)
        
        docs = await retriever.ainvoke("main topics overview key points")
        # Hard truncate context to avoid Free Tier token explosion
        context = self._format_docs(docs)[:2500]

        prompt = f"""Summarize this document concisely in markdown format:

## Main Topic
What is this document about? (1-2 sentences)

## Key Points
- Bullet point the most important ideas

## Key Terms
- Important vocabulary or concepts

Text:
{context}"""
        response = await self._invoke_with_retry(llm, prompt)
        return response.content.strip()

    # --- Document Management ---
    def save_document_info(self, document_id: str, filename: str, chunks: int, user_id: int):
        """Save document metadata to a JSON file associated with a user."""
        docs = self._load_json(DOCUMENTS_FILE, [])
        # Don't add duplicates
        docs = [d for d in docs if not (d["document_id"] == document_id and d.get("user_id") == user_id)]
        docs.append({
            "document_id": document_id,
            "filename": filename,
            "chunks": chunks,
            "user_id": user_id,
            "uploaded_at": datetime.now().isoformat()
        })
        self._save_json(DOCUMENTS_FILE, docs)

    def get_documents(self, user_id: int):
        """Get list of all uploaded documents for a specific user."""
        docs = self._load_json(DOCUMENTS_FILE, [])
        return [d for d in docs if d.get("user_id") == user_id]

    def delete_document(self, document_id: str, user_id: int):
        """Delete a single document and its chat history for a specific user."""
        docs = self._load_json(DOCUMENTS_FILE, [])
        docs = [d for d in docs if not (d["document_id"] == document_id and d.get("user_id") == user_id)]
        self._save_json(DOCUMENTS_FILE, docs)
        
        # Also delete messages from DB
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM messages WHERE user_id = ? AND document_id = ?", (user_id, document_id))
            conn.commit()
        except Exception as e:
            logger.error(f"Error deleting messages for doc {document_id}: {e}")
        finally:
            conn.close()

    def delete_all_documents(self, user_id: int):
        """Clear all documents and chat history for a specific user."""
        docs = self._load_json(DOCUMENTS_FILE, [])
        docs = [d for d in docs if d.get("user_id") != user_id]
        self._save_json(DOCUMENTS_FILE, docs)
        
        # Also delete all messages for this user
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM messages WHERE user_id = ?", (user_id,))
            conn.commit()
        except Exception as e:
            logger.error(f"Error deleting all messages for user {user_id}: {e}")
        finally:
            conn.close()

    # --- Quiz History ---
    def save_quiz_score(self, document_id: str, score: int, total: int, user_id: int):
        """Save a quiz score to history for a specific user."""
        history = self._load_json(HISTORY_FILE, [])
        history.append({
            "document_id": document_id,
            "score": score,
            "total": total,
            "user_id": user_id,
            "percentage": round((score / total) * 100) if total > 0 else 0,
            "timestamp": datetime.now().isoformat()
        })
        self._save_json(HISTORY_FILE, history)

    def get_quiz_history(self, user_id: int, document_id: str = None):
        """Get quiz score history for a specific user, optionally filtered by document."""
        history = self._load_json(HISTORY_FILE, [])
        user_history = [h for h in history if h.get("user_id") == user_id]
        if document_id:
            user_history = [h for h in user_history if h["document_id"] == document_id]
        return user_history

    def _load_json(self, filepath, default):
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return default
        return default

    def _save_json(self, filepath, data):
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    # --- Chat History Management ---
    def save_chat_message(self, user_id: int, document_id: str, role: str, content: str):
        """Save a chat message to the SQLite database."""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO messages (user_id, document_id, role, content) VALUES (?, ?, ?, ?)",
                (user_id, document_id, role, content)
            )
            conn.commit()
        except Exception as e:
            logger.error(f"Error saving chat message: {e}")
        finally:
            conn.close()

    def get_chat_history(self, user_id: int, document_id: str):
        """Retrieve chat history for a specific user and document."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT role, content, timestamp FROM messages WHERE user_id = ? AND document_id = ? ORDER BY timestamp ASC",
                (user_id, document_id)
            )
            rows = cursor.fetchall()
            return [{"role": row["role"], "content": row["content"], "timestamp": row["timestamp"]} for row in rows]
        except Exception as e:
            logger.error(f"Error retrieving chat history: {e}")
            return []
        finally:
            conn.close()

    def _get_vectorstore(self, document_id: str):
        """Load (or return cached) the vectorstore for the given document_id."""
        provider = "gemini"
        if document_id.endswith("_local"):
            provider = "ollama"
        elif document_id.endswith("_hf"):
            provider = "huggingface"

        if document_id in self._vectorstore_cache:
            return self._vectorstore_cache[document_id]
        
        full_path = os.path.join(VECTOR_STORE_DIR, document_id)
        if not os.path.exists(full_path):
            raise ValueError(f"Vector store for document '{document_id}' not found.")

        embeddings = self._get_embeddings(provider=provider)
        vectorstore = FAISS.load_local(full_path, embeddings, allow_dangerous_deserialization=True)
        self._vectorstore_cache[document_id] = vectorstore
        return vectorstore

    # --- Global Search (Cross-Document) ---
    async def global_chat(self, user_id: int, query: str):
        """Perform a chat query across all documents owned by the user."""
        docs_info = self.get_documents(user_id)
        if not docs_info:
            return {
                "answer": "You haven't uploaded any documents yet. Upload some files to use Global Search!",
                "sources": []
            }
        
        # Check if we can use cached merged vectorstore
        current_docs = sorted([d["document_id"] for d in docs_info])
        if self._merged_vs_cache and self._merged_id_list == current_docs:
            logger.info("Using CACHED merged vectorstore for global search")
            merged_vs = self._merged_vs_cache
        else:
            logger.info(f"Merging {len(current_docs)} vectorstores for global search...")
            merged_vs = None
            for d in docs_info:
                doc_id = d["document_id"]
                try:
                    vs = self._get_vectorstore(doc_id)
                    # Create a copy for merging to avoid mutating the cached individual store
                    provider = "gemini"
                    if doc_id.endswith("_local"): provider = "ollama"
                    elif doc_id.endswith("_hf"): provider = "huggingface"
                    embeddings = self._get_embeddings(provider=provider)
                    
                    full_path = os.path.join(VECTOR_STORE_DIR, doc_id)
                    temp_vs = FAISS.load_local(full_path, embeddings, allow_dangerous_deserialization=True)
                    
                    if merged_vs is None:
                        merged_vs = temp_vs
                    else:
                        merged_vs.merge_from(temp_vs)
                except Exception as e:
                    logger.warning(f"Skipping document {doc_id} in global search: {e}")
            
            # Cache the result
            self._merged_vs_cache = merged_vs
            self._merged_id_list = current_docs

        if not merged_vs:
            return {"answer": "Error initializing search index. Please try uploading your documents again.", "sources": []}

        # Use merged retriever
        retriever = merged_vs.as_retriever(search_kwargs={"k": 6})
        llm = self._get_llm(False) # Use primary LLM for global search
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful study assistant. Use the following context from MULTIPLE documents to answer the user's question. Be clear about which information comes from which source if possible. Citation format: [Document Name]. Keep answers concise but comprehensive.\n\nContext:\n{context}"),
            ("human", "{question}"),
        ])

        relevant_docs = await retriever.ainvoke(query)
        # Format docs with filenames clearly labeled for the LLM
        formatted_context = ""
        for i, doc in enumerate(relevant_docs):
            fname = doc.metadata.get("filename", "Unknown")
            formatted_context += f"\n--- DOCUMENT: {fname} ---\n{doc.page_content}\n"
            
        context = formatted_context[:8000]
        
        # Identify which documents were actually used
        sources = []
        for doc in relevant_docs:
            source_filename = doc.metadata.get("filename", "Unknown Document")
            if source_filename not in sources:
                sources.append(source_filename)

        answer_response = await self._invoke_with_retry(llm, prompt.format(context=context, question=query))
        
        if hasattr(answer_response, "content"):
            answer_text = answer_response.content
        else:
            answer_text = str(answer_response)

        return {
            "answer": answer_text,
            "sources": sources
        }

llm_service = LLMService()
