import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

def test_gemini():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY not found in .env")
        return

    print(f"Testing Gemini with key: {api_key[:10]}...")
    
    # Test primary model
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", google_api_key=api_key)
        response = llm.invoke("Hello, are you working?")
        print(f"✅ gemini-1.5-flash-latest: {response.content}")
    except Exception as e:
        print(f"❌ gemini-1.5-flash-latest failed: {e}")

    # Test fallback model
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro-latest", google_api_key=api_key)
        response = llm.invoke("Hello, are you working?")
        print(f"✅ gemini-1.5-pro-latest: {response.content}")
    except Exception as e:
        print(f"❌ gemini-1.5-pro-latest failed: {e}")

if __name__ == "__main__":
    test_gemini()
