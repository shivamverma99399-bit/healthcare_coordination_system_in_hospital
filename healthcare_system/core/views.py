from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
from .models import Hospital, Doctor
from .map_services import get_nearby_hospitals
from .ai import analyze_symptom


def recommend(request):
    lat = float(request.GET.get('lat'))
    lng = float(request.GET.get('lng'))
    symptom = request.GET.get('symptom', '')
    specialization, urgency = analyze_symptom(symptom)  
    nearby = get_nearby_hospitals(lat, lng)

    results = []

    for g in nearby:
        try:
            h = Hospital.objects.get(place_id=g["place_id"])
        except:
            continue

        score = 0
        reasons = []

        if Doctor.objects.filter(hospital=h, specialization__icontains=specialization, available=True).exists():
            score += 40
            reasons.append(f"{specialization} specialist available")

        if h.available_beds > 0:
            score += 30
            reasons.append(f"{h.available_beds} beds available")

        if urgency == "critical" and h.available_icu > 0:
            score += 40
            reasons.append(f"{h.available_icu} ICU beds available")

        if h.opd_load < 10:
            score += 20
            reasons.append(f"Low wait ({h.opd_load} patients)")

        reasons.append(f"{round(g.get('distance',0)/1000,2)} km away")
        results.append({
            "hospital": h.name,
            "score": round(score, 2),
            "reasons": reasons
        })

    results = sorted(results, key=lambda x: x["score"], reverse=True)

    return JsonResponse({"results": results[:3]})