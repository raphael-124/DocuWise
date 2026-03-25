import os
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

def test_models():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: NO API KEY")
        return

    models = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-002",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro"
    ]

    results = {}
    for m in models:
        print(f"Testing {m}...")
        try:
            llm = ChatGoogleGenerativeAI(model=m, google_api_key=api_key)
            resp = llm.invoke("Quick check")
            print(f"  ✅ {m} SUCCESSS!")
            results[m] = "SUCCESS"
        except Exception as e:
            err = str(e).split('\n')[0]
            print(f"  ❌ {m} FAILED: {err}")
            results[m] = f"FAILED: {err}"

    print("\n--- FINAL RESULTS ---")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    test_models()
