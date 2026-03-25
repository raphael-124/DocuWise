import asyncio
import os
from dotenv import load_dotenv
from app.services.llm_service import llm_service

load_dotenv()

async def verify_final():
    print("Verifying LLMService with models/gemini-2.5-flash...")
    # We'll use a dummy user_id and document_id for the test
    # Note: verify_document_ownership might fail if documents.json is empty or doesn't have 999
    # So we'll bypass it for the test by manually calling _invoke_with_retry
    
    llm = llm_service._get_llm()
    print(f"Testing primary LLM...")
    
    try:
        response = await llm_service._invoke_with_retry(llm, "Hello, final test.")
        print(f"✅ FINAL SUCCESS: {response.content[:50]}...")
    except Exception as e:
        print(f"❌ FINAL FAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(verify_final())
