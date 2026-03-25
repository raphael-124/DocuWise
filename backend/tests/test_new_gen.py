import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def test_new_models():
    api_key = os.getenv("GOOGLE_API_KEY")
    genai.configure(api_key=api_key)
    
    # These models were seen in the list_models output
    models = ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-flash']
    
    for m in models:
        print(f"Testing {m}...")
        try:
            model = genai.GenerativeModel(m)
            response = model.generate_content("Hi")
            print(f"✅ SUCCESS with {m}: {response.text[:20]}...")
            break
        except Exception as e:
            print(f"❌ FAILED with {m}: {e}")

if __name__ == "__main__":
    test_new_models()
