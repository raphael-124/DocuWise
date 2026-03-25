import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def test_raw():
    api_key = os.getenv("GOOGLE_API_KEY")
    genai.configure(api_key=api_key)
    
    # Try the most basic call
    model_name = 'gemini-1.5-flash'
    print(f"Testing raw genai with {model_name}...")
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hi")
        print(f"✅ SUCCESS raw: {response.text}")
    except Exception as e:
        print(f"❌ FAILED raw: {e}")

if __name__ == "__main__":
    test_raw()
