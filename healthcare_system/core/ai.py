import google.generativeai as genai

genai.configure(api_key="YOUR_GEMINI_KEY")
model = genai.GenerativeModel("gemini-pro")

def analyze_symptom(text):
    prompt = f"""
    Symptoms: {text}
    Return exactly:
    specialization: <one word>
    urgency: normal/urgent/critical
    """
    try:
        out = model.generate_content(prompt).text.strip().split("\n")
        spec = out[0].split(":")[-1].strip().lower()
        urg = out[1].split(":")[-1].strip().lower()
        return spec if spec else "general", urg if urg else "normal"
    except:
        return "general", "normal"