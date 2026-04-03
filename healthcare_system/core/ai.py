import json

from django.conf import settings


VALID_URGENCY_LEVELS = {"normal", "urgent", "critical"}


def get_gemini_model():
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        return None

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    return genai.GenerativeModel(getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash"))


def analyze_symptoms_with_gemini(symptoms, fallback_urgency="normal"):
    model = get_gemini_model()
    if not model:
        return None

    prompt = build_prompt(symptoms, fallback_urgency)

    try:
        response = model.generate_content(prompt)
        raw_text = getattr(response, "text", "") or ""
        parsed = parse_ai_json(raw_text)
        return normalize_ai_response(parsed, symptoms, fallback_urgency)
    except Exception:
        return None


def build_prompt(symptoms, fallback_urgency):
    return f"""
You are assisting a healthcare coordination backend.
Read the symptom description and convert it into clean JSON only.

Rules:
- Return valid JSON only. No markdown, no explanation.
- Use urgency from: normal, urgent, critical.
- Keep symptom_tags short and useful.
- recommended_specializations must use common doctor categories like:
  general physician, cardiologist, neurologist, orthopedic, dermatologist, pulmonologist, pediatrician
- If uncertain, include "general physician".

Input symptoms: "{symptoms}"
User selected urgency: "{fallback_urgency}"

Return this exact JSON shape:
{{
  "symptom_tags": ["tag1", "tag2"],
  "recommended_specializations": ["general physician"],
  "urgency": "normal",
  "summary": "short medical routing summary"
}}
""".strip()


def parse_ai_json(raw_text):
    cleaned_text = raw_text.strip()
    if cleaned_text.startswith("```"):
        cleaned_text = cleaned_text.strip("`")
        cleaned_text = cleaned_text.replace("json", "", 1).strip()

    start_index = cleaned_text.find("{")
    end_index = cleaned_text.rfind("}")
    if start_index == -1 or end_index == -1:
        raise ValueError("No JSON object found in Gemini response.")

    return json.loads(cleaned_text[start_index : end_index + 1])


def normalize_ai_response(parsed, symptoms, fallback_urgency):
    tags = parsed.get("symptom_tags") or []
    specializations = parsed.get("recommended_specializations") or ["general physician"]
    urgency = str(parsed.get("urgency") or fallback_urgency).lower()
    summary = parsed.get("summary") or "AI-assisted symptom analysis completed."

    if urgency not in VALID_URGENCY_LEVELS:
        urgency = fallback_urgency if fallback_urgency in VALID_URGENCY_LEVELS else "normal"

    normalized_tags = [str(tag).strip().lower() for tag in tags if str(tag).strip()]
    normalized_specializations = [
        str(item).strip().lower() for item in specializations if str(item).strip()
    ]

    if not normalized_specializations:
        normalized_specializations = ["general physician"]

    return {
        "symptoms": symptoms,
        "symptom_tags": normalized_tags[:5],
        "recommended_specializations": normalized_specializations[:3],
        "urgency": urgency,
        "summary": str(summary).strip(),
        "source": "gemini",
    }
