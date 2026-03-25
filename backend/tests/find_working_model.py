import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def find_working_model():
    api_key = os.getenv("GOOGLE_API_KEY")
    genai.configure(api_key=api_key)
    
    print("Listing ALL models...")
    models = []
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models.append(m.name)
    except Exception as e:
        print(f"Error listing: {e}")
        return

    print(f"Found {len(models)} candidate models. Testing all...")
    for m in models:
        # Strip 'models/' if it exists
        name = m.replace('models/', '')
        print(f"Testing {m} (as {name})...")
        try:
            model = genai.GenerativeModel(m)
            response = model.generate_content("Hi")
            print(f"✅ SUCCESS with {m}!")
            with open("working_model.txt", "w") as f:
                f.write(m)
            return
        except Exception as e:
            print(f"  ❌ {m} failed: {str(e)[:100]}")

if __name__ == "__main__":
    find_working_model()
