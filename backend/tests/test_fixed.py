import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

def test_fixed():
    api_key = os.getenv("GOOGLE_API_KEY")
    # Try with explicit model version that is usually stable
    model = "gemini-1.5-flash" 
    print(f"Testing {model}...")
    try:
        # Some versions of the library need the models/ prefix, some don't.
        # But usually gemini-1.5-flash is safe.
        llm = ChatGoogleGenerativeAI(model=model, google_api_key=api_key)
        resp = llm.invoke("Hi")
        print(f"✅ SUCCESS with {model}")
    except Exception as e:
        print(f"❌ FAILED with {model}: {e}")

    model2 = "gemini-1.5-pro"
    print(f"Testing {model2}...")
    try:
        llm = ChatGoogleGenerativeAI(model=model2, google_api_key=api_key)
        resp = llm.invoke("Hi")
        print(f"✅ SUCCESS with {model2}")
    except Exception as e:
        print(f"❌ FAILED with {model2}: {e}")

if __name__ == "__main__":
    test_fixed()
