from math import asin, cos, radians, sin, sqrt
import re

from django.conf import settings
from django.contrib.auth.models import User
from django.db import DatabaseError
from django.db import transaction

from .ai import analyze_symptoms_with_gemini
from .models import (
    Booking,
    Doctor,
    Hospital,
    HospitalAdminProfile,
    InterHospitalTransfer,
    PatientProfile,
    SosAlert,
)


SPECIALIZATION_RULES = {
    "general_physician": {
        "label": "General Physician",
        "keywords": [
            "fever",
            "cold",
            "cough",
            "fatigue",
            "vomiting",
            "weakness",
            "infection",
        ],
    },
    "cardiologist": {
        "label": "Cardiologist",
        "keywords": [
            "chest pain",
            "palpitations",
            "heart",
            "bp",
            "blood pressure",
            "cardio",
        ],
    },
    "neurologist": {
        "label": "Neurologist",
        "keywords": [
            "headache",
            "seizure",
            "migraine",
            "dizziness",
            "stroke",
        ],
    },
    "orthopedic": {
        "label": "Orthopedic",
        "keywords": [
            "fracture",
            "joint pain",
            "back pain",
            "leg pain",
            "bone",
        ],
    },
    "dermatologist": {
        "label": "Dermatologist",
        "keywords": [
            "rash",
            "skin",
            "itching",
            "allergy",
        ],
    },
    "pulmonologist": {
        "label": "Pulmonologist",
        "keywords": [
            "breathing",
            "breathlessness",
            "asthma",
            "wheezing",
            "lung",
        ],
    },
    "pediatrician": {
        "label": "Pediatrician",
        "keywords": [
            "child",
            "baby",
            "infant",
            "kid",
        ],
    },
}

SPECIALIZATION_ALIASES = {
    "general": "general_physician",
    "general physician": "general_physician",
    "physician": "general_physician",
    "cardio": "cardiologist",
    "cardiology": "cardiologist",
    "cardiologist": "cardiologist",
    "neuro": "neurologist",
    "neurology": "neurologist",
    "neurologist": "neurologist",
    "ortho": "orthopedic",
    "orthopedic": "orthopedic",
    "orthopaedic": "orthopedic",
    "derma": "dermatologist",
    "dermatology": "dermatologist",
    "dermatologist": "dermatologist",
    "pulmo": "pulmonologist",
    "pulmonology": "pulmonologist",
    "pulmonologist": "pulmonologist",
    "pediatrics": "pediatrician",
    "pediatrician": "pediatrician",
}

EMERGENCY_KEYWORDS = {
    "critical": [
        "unconscious",
        "severe bleeding",
        "stroke",
        "heart attack",
        "not breathing",
    ],
    "urgent": [
        "high fever",
        "chest pain",
        "difficulty breathing",
        "severe pain",
    ],
}

SEVERITY_BY_URGENCY = {
    "normal": "low",
    "urgent": "medium",
    "critical": "high",
}

URGENCY_WEIGHT = {
    "low": 10,
    "medium": 16,
    "high": 24,
}

LOCATION_COORDINATES = {
    "central delhi": (28.6145, 77.2092),
    "connaught place": (28.6315, 77.2167),
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "gurgaon": (28.4595, 77.0266),
    "gurugram": (28.4595, 77.0266),
    "noida": (28.5355, 77.3910),
    "noida extension": (28.6400, 77.4300),
    "ghaziabad": (28.6692, 77.4538),
    "okhla": (28.5619, 77.2749),
    "sarita vihar": (28.5402, 77.2837),
    "saket": (28.5245, 77.2066),
    "dwarka": (28.5921, 77.0460),
    "rajinder nagar": (28.6386, 77.1894),
    "pusa road": (28.6434, 77.1897),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "mumbai": (19.0760, 72.8777),
}

DEMO_PATIENT = {
    "email": "patient@medpulse.local",
    "password": "patient123",
    "full_name": "Asha Verma",
    "city": "Delhi",
    "phone": "9999999999",
    "emergency_contact": "Rohan Verma",
}

DEMO_ADMIN_PASSWORD = "admin123"
FALLBACK_DEMO_ADMIN_HOSPITALS = [
    "Demo Hospital 1",
    "Demo Hospital 2",
    "Demo Hospital 3",
]
DEMO_ADMIN_EMAIL_PATTERN = re.compile(r"^admin\d+@medpulse\.local$")


def build_admin_identifier(user, hospital=None):
    if hospital:
        hospital_slug = re.sub(r"[^a-z0-9]+", "", hospital.name.lower())[:8] or "hospital"
    else:
        hospital_slug = "admin"

    base = re.sub(r"[^a-z0-9]+", "", (user.username or user.email or "admin").lower())[:12] or "admin"
    return f"{hospital_slug}-{base}"


def generate_unique_admin_identifier(user, hospital=None, exclude_profile_id=None):
    base_identifier = build_admin_identifier(user, hospital=hospital)
    candidate = base_identifier
    suffix = 1

    while HospitalAdminProfile.objects.exclude(id=exclude_profile_id).filter(admin_id=candidate).exists():
        candidate = f"{base_identifier[:50]}-{suffix}"
        suffix += 1

    return candidate


def ensure_admin_profile(user):
    if hasattr(user, "hospital_admin_profile"):
        profile = user.hospital_admin_profile
        updates = []
        if not profile.admin_id:
            profile.admin_id = generate_unique_admin_identifier(
                user,
                hospital=profile.hospital,
                exclude_profile_id=profile.id,
            )
            updates.append("admin_id")
        if updates:
            profile.save(update_fields=updates)
        return profile

    if not getattr(user, "is_superuser", False):
        return None

    hospital = Hospital.objects.order_by("name").first()
    if not hospital:
        return None

    profile, created = HospitalAdminProfile.objects.get_or_create(
        user=user,
        defaults={
            "hospital": hospital,
            "title": "Platform Superuser",
            "admin_id": generate_unique_admin_identifier(user, hospital=hospital),
        },
    )
    if not created and not profile.admin_id:
        profile.admin_id = generate_unique_admin_identifier(
            user,
            hospital=profile.hospital,
            exclude_profile_id=profile.id,
        )
        profile.save(update_fields=["admin_id"])
    return profile


def split_name(full_name):
    cleaned = (full_name or "").strip()
    if not cleaned:
        return "", ""
    parts = cleaned.split()
    return parts[0], " ".join(parts[1:])


def role_for_user(user):
    if getattr(user, "is_superuser", False) or hasattr(user, "hospital_admin_profile"):
        return "hospital_admin"
    if hasattr(user, "patient_profile"):
        return "patient"
    return "unknown"


def get_admin_access_scope(user, hospital_id=None):
    profile = ensure_admin_profile(user)
    if profile and not getattr(user, "is_superuser", False):
        return {
            "is_superuser": False,
            "title": profile.title,
            "hospital": profile.hospital,
            "profile": profile,
        }

    if getattr(user, "is_superuser", False):
        hospitals = Hospital.objects.order_by("name")
        hospital = profile.hospital if profile else None
        if hospital_id is not None:
            hospital = hospitals.filter(id=hospital_id).first()
        elif hospital is None:
            hospital = hospitals.first()
        return {
            "is_superuser": True,
            "title": profile.title if profile else "Platform Superuser",
            "hospital": hospital,
            "profile": profile,
        }

    return None


def serialize_access_session(user, token_key):
    role = role_for_user(user)
    payload = {
        "token": token_key,
        "role": role,
        "email": user.email,
        "display_name": user.get_full_name() or user.username,
    }

    if role == "patient":
        profile = user.patient_profile
        payload["profile"] = {
            "full_name": profile.full_name,
            "city": profile.city,
            "phone": profile.phone,
            "emergency_contact": profile.emergency_contact,
        }
    elif role == "hospital_admin":
        profile = get_admin_access_scope(user)
        hospital = profile["hospital"] if profile else None
        payload["profile"] = {
            "name": user.get_full_name() or user.username,
            "admin_id": profile["profile"].admin_id if profile and profile["profile"] else "",
            "title": profile["title"] if profile else "Hospital Admin",
            "hospital": (
                {
                    "id": hospital.id,
                    "name": hospital.name,
                    "location": hospital.location,
                }
                if hospital
                else None
            ),
        }
        payload["is_superuser"] = bool(getattr(user, "is_superuser", False))

    return payload


def _update_user_identity(user, email, full_name):
    first_name, last_name = split_name(full_name)
    changed = False

    if user.email != email:
        user.email = email
        changed = True
    if user.first_name != first_name:
        user.first_name = first_name
        changed = True
    if user.last_name != last_name:
        user.last_name = last_name
        changed = True

    return changed


def _update_password_if_needed(user, raw_password):
    if user.check_password(raw_password):
        return False

    user.set_password(raw_password)
    return True


def _demo_accounts_snapshot():
    accounts = [
        {
            "role": "patient",
            "email": DEMO_PATIENT["email"],
            "password": DEMO_PATIENT["password"],
            "label": "Patient demo",
            "hospital_name": "",
        }
    ]

    try:
        hospital_names = list(Hospital.objects.order_by("name").values_list("name", flat=True)[:3])
    except DatabaseError:
        hospital_names = FALLBACK_DEMO_ADMIN_HOSPITALS

    for index, hospital_name in enumerate(hospital_names, start=1):
        accounts.append(
            {
                "role": "hospital_admin",
                "email": f"admin{index}@medpulse.local",
                "password": DEMO_ADMIN_PASSWORD,
                "label": "Hospital admin demo",
                "hospital_name": hospital_name,
            }
        )

    return accounts


def is_demo_account_enabled():
    return bool(getattr(settings, "DEMO_ACCOUNTS_ENABLED", False))


def is_demo_account_email(email, role=None):
    normalized = (email or "").strip().lower()
    if role == "patient":
        return normalized == DEMO_PATIENT["email"]
    if role == "hospital_admin":
        return bool(DEMO_ADMIN_EMAIL_PATTERN.match(normalized))
    return normalized == DEMO_PATIENT["email"] or bool(DEMO_ADMIN_EMAIL_PATTERN.match(normalized))


@transaction.atomic
def ensure_demo_access_profiles():
    patient_user, _ = User.objects.get_or_create(
        username=DEMO_PATIENT["email"],
        defaults={
            "email": DEMO_PATIENT["email"],
        },
    )
    user_changed = _update_user_identity(
        patient_user,
        DEMO_PATIENT["email"],
        DEMO_PATIENT["full_name"],
    )
    password_changed = _update_password_if_needed(patient_user, DEMO_PATIENT["password"])
    if user_changed or password_changed:
        patient_user.save()
    PatientProfile.objects.update_or_create(
        user=patient_user,
        defaults={
            "full_name": DEMO_PATIENT["full_name"],
            "city": DEMO_PATIENT["city"],
            "phone": DEMO_PATIENT["phone"],
            "emergency_contact": DEMO_PATIENT["emergency_contact"],
        },
    )

    demo_accounts = _demo_accounts_snapshot()

    for index, hospital in enumerate(Hospital.objects.order_by("name")[:3], start=1):
        email = f"admin{index}@medpulse.local"
        admin_user, _ = User.objects.get_or_create(
            username=email,
            defaults={"email": email},
        )
        user_changed = False
        if admin_user.email != email:
            admin_user.email = email
            user_changed = True
        if admin_user.first_name != f"Admin {index}":
            admin_user.first_name = f"Admin {index}"
            user_changed = True
        if admin_user.last_name:
            admin_user.last_name = ""
            user_changed = True
        password_changed = _update_password_if_needed(admin_user, DEMO_ADMIN_PASSWORD)
        if user_changed or password_changed:
            admin_user.save()
        HospitalAdminProfile.objects.update_or_create(
            user=admin_user,
            defaults={
                "hospital": hospital,
                "admin_id": f"ADM-{index:03d}",
                "title": "Hospital Operations Admin",
            },
        )
    return demo_accounts


def get_demo_access_profiles():
    if not is_demo_account_enabled():
        return []
    try:
        return ensure_demo_access_profiles()
    except DatabaseError:
        return _demo_accounts_snapshot()


def maybe_seed_demo_access_profiles(email, role=None):
    if not is_demo_account_enabled() or not is_demo_account_email(email, role=role):
        return
    try:
        ensure_demo_access_profiles()
    except DatabaseError:
        return


def analyze_symptoms(symptoms, location="", urgency="normal"):
    context = build_analysis_context(symptoms, location=location, urgency=urgency)
    return {
        "tags": context["tags"],
        "severity": context["severity"],
        "urgency": context["urgency"],
        "summary": context["summary"],
        "next_steps": build_patient_next_steps(
            severity=context["severity"],
            location=location,
            tags=context["tags"],
        ),
    }


def build_analysis_context(symptoms, location="", urgency="normal"):
    symptom_text = (symptoms or "").strip().lower()
    fallback_urgency = normalize_requested_urgency(urgency)
    ai_result = analyze_symptoms_with_gemini(symptoms, fallback_urgency=fallback_urgency)

    if ai_result:
        resolved_urgency = normalize_urgency(symptom_text, ai_result.get("urgency"))
        tags = resolve_specialization_tags(ai_result.get("recommended_specializations"))
        summary = ai_result.get("summary") or build_analysis_summary(tags, resolved_urgency)
    else:
        resolved_urgency = normalize_urgency(symptom_text, fallback_urgency)
        tags = infer_tags_from_symptoms(symptom_text)
        summary = build_analysis_summary(tags, resolved_urgency)

    return {
        "symptoms": symptoms,
        "location": location,
        "urgency": resolved_urgency,
        "severity": SEVERITY_BY_URGENCY[resolved_urgency],
        "tags": tags,
        "summary": summary,
    }


def get_hospital_recommendations(
    symptoms,
    location="",
    urgency="normal",
    max_distance=None,
    require_icu=False,
    specialization=None,
    latitude=None,
    longitude=None,
):
    analysis = build_analysis_context(symptoms, location=location, urgency=urgency)
    requested_tags = analysis["tags"]
    specialization_filter = normalize_specialization_tag(specialization)
    if specialization_filter:
        requested_tags = [specialization_filter]

    source_lat, source_lng = resolve_coordinates(location, latitude, longitude)
    hospitals = Hospital.objects.all().prefetch_related("doctors", "doctors__availabilities")
    recommendations = []

    for hospital in hospitals:
        distance_km = calculate_distance_km(
            source_lat,
            source_lng,
            hospital.latitude,
            hospital.longitude,
        )

        if max_distance is not None and distance_km > max_distance:
            continue

        available_doctors = [doctor for doctor in hospital.doctors.all() if doctor.available]
        matched_doctors = [
            doctor
            for doctor in available_doctors
            if not requested_tags
            or normalize_specialization_tag(doctor.specialization) in requested_tags
        ]

        if specialization_filter and not matched_doctors:
            continue

        if require_icu and hospital.available_icu <= 0:
            continue

        response_tags = (
            requested_tags
            if matched_doctors
            else collect_hospital_specializations(available_doctors)[:2]
        ) or ["general_physician"]

        score_breakdown = calculate_ai_score_breakdown(
            distance_km=distance_km,
            available_beds=hospital.available_beds,
            available_icu=hospital.available_icu,
            severity=analysis["severity"],
            matched_doctors_count=len(matched_doctors),
            emergency_available=hospital.emergency_available,
            avg_wait_time=hospital.avg_wait_time,
        )
        ai_score = score_breakdown["total"]

        recommendations.append(
            {
                "id": hospital.id,
                "hospital_name": hospital.name,
                "distance": round(distance_km, 1),
                "beds_available": hospital.available_beds,
                "icu_available": hospital.available_icu,
                "ai_score": ai_score,
                "ai_reason": build_ai_reason(
                    distance_km=distance_km,
                    available_beds=hospital.available_beds,
                    available_icu=hospital.available_icu,
                    severity=analysis["severity"],
                    tags=response_tags,
                    emergency_available=hospital.emergency_available,
                    avg_wait_time=hospital.avg_wait_time,
                ),
                "specialization": response_tags,
                "location": hospital.location,
                "emergency_available": hospital.emergency_available,
                "score_breakdown": {
                    "distance": score_breakdown["distance"],
                    "capacity": score_breakdown["capacity"],
                    "specialist_match": score_breakdown["specialist_match"],
                    "urgency": score_breakdown["urgency"],
                    "emergency": score_breakdown["emergency"],
                },
                "care_pathway": build_care_pathway(analysis["severity"], hospital.emergency_available),
                "next_steps": build_hospital_next_steps(
                    severity=analysis["severity"],
                    hospital=hospital,
                    tags=response_tags,
                ),
            }
        )

    recommendations.sort(key=lambda item: (-item["ai_score"], item["distance"], item["hospital_name"]))
    return recommendations


def calculate_ai_score_breakdown(
    distance_km,
    available_beds,
    available_icu,
    severity,
    matched_doctors_count,
    emergency_available,
    avg_wait_time,
):
    distance_score = max(5, 35 - (distance_km * 2.8))
    capacity_score = min(20, available_beds * 1.5) + min(18, available_icu * 6)
    wait_time_penalty = min(8, max(0, avg_wait_time - 10) / 3)
    specialist_score = min(15, matched_doctors_count * 8) if matched_doctors_count else 4
    urgency_score = URGENCY_WEIGHT[severity]
    emergency_score = 8 if severity == "high" and emergency_available else 0
    total = distance_score + capacity_score - wait_time_penalty + specialist_score + urgency_score + emergency_score

    return {
        "distance": int(round(distance_score)),
        "capacity": int(round(capacity_score - wait_time_penalty)),
        "specialist_match": int(round(specialist_score)),
        "urgency": int(round(urgency_score)),
        "emergency": int(round(emergency_score)),
        "total": min(99, max(1, int(round(total)))),
    }


def build_ai_reason(
    distance_km,
    available_beds,
    available_icu,
    severity,
    tags,
    emergency_available,
    avg_wait_time,
):
    lead_tag = tags[0] if tags else "general_physician"
    distance_reason = (
        "close to the searched location"
        if distance_km <= 5
        else "within a manageable travel radius"
        if distance_km <= 15
        else "available despite a longer travel distance"
    )
    icu_reason = (
        f"with {available_icu} ICU bed(s) ready"
        if available_icu
        else "with standard inpatient capacity"
    )
    urgency_reason = (
        "and emergency support for high-severity triage"
        if severity == "high" and emergency_available
        else f"for {severity} severity care routing"
    )
    return (
        f"{distance_reason}, {available_beds} bed(s) open, {icu_reason}, "
        f"estimated wait around {avg_wait_time} min, best suited for "
        f"{lead_tag.replace('_', ' ')} {urgency_reason}."
    )


def build_analysis_summary(tags, urgency):
    focus_area = tags[0].replace("_", " ") if tags else "general physician"
    return (
        f"AI triage suggests {focus_area} review with a {urgency} priority route. "
        "Use live bed, ICU, and doctor availability before confirming care."
    )


def build_patient_next_steps(severity, location, tags):
    specialist = tags[0].replace("_", " ") if tags else "general physician"
    steps = [
        f"Review hospitals near {location or 'your city'} with live capacity data.",
        f"Prioritize doctors covering {specialist}.",
    ]
    if severity == "high":
        steps.insert(0, "Use the SOS pathway immediately if symptoms worsen or travel is unsafe.")
    else:
        steps.append("Book the earliest suitable appointment and keep the dashboard updated.")
    return steps


def build_hospital_next_steps(severity, hospital, tags):
    steps = [
        f"Check doctor schedules at {hospital.name}.",
        "Confirm appointment or escalate through SOS if the condition worsens.",
    ]
    if severity == "high":
        steps.insert(0, "Prefer hospitals with emergency support and ICU capacity.")
    if tags:
        steps.append(f"Ask for {tags[0].replace('_', ' ')} support during intake.")
    return steps


def build_care_pathway(severity, emergency_available):
    if severity == "high" and emergency_available:
        return "Immediate emergency route"
    if severity == "high":
        return "Rapid triage route"
    if severity == "medium":
        return "Priority consultation route"
    return "Routine coordinated care route"


def resolve_specialization_tags(items):
    resolved = []
    for item in items or []:
        tag = normalize_specialization_tag(item)
        if tag and tag not in resolved:
            resolved.append(tag)
    return resolved or ["general_physician"]


def infer_tags_from_symptoms(symptom_text):
    matched_tags = []
    for tag, rule in SPECIALIZATION_RULES.items():
        if any(keyword in symptom_text for keyword in rule["keywords"]):
            matched_tags.append(tag)
    return matched_tags or ["general_physician"]


def collect_hospital_specializations(doctors):
    tags = []
    for doctor in doctors:
        tag = normalize_specialization_tag(doctor.specialization)
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def normalize_specialization_tag(value):
    if not value:
        return None

    cleaned = str(value).strip().lower().replace("-", " ").replace("_", " ")
    if cleaned in SPECIALIZATION_ALIASES:
        return SPECIALIZATION_ALIASES[cleaned]

    for tag, rule in SPECIALIZATION_RULES.items():
        if cleaned == rule["label"].lower():
            return tag

    return cleaned.replace(" ", "_") if cleaned else None


def normalize_requested_urgency(urgency):
    cleaned = (urgency or "normal").strip().lower()
    if cleaned in SEVERITY_BY_URGENCY:
        return cleaned
    return "normal"


def normalize_urgency(symptom_text, urgency):
    resolved_urgency = normalize_requested_urgency(urgency)

    for level in ("critical", "urgent"):
        if any(keyword in symptom_text for keyword in EMERGENCY_KEYWORDS[level]):
            return level

    return resolved_urgency


def build_transfer_report(booking, source_hospital, target_hospital):
    specializations = ", ".join(booking.recommended_specializations or ["general physician"])
    return "\n".join(
        [
            "INTER-HOSPITAL CARE REPORT",
            "",
            f"Patient: {booking.patient_name}",
            f"Urgency: {booking.urgency}",
            f"Current status: {booking.status}",
            f"Source hospital: {source_hospital.name}",
            f"Receiving hospital: {target_hospital.name}",
            f"Assigned doctor: {booking.doctor.name if booking.doctor else 'Not assigned'}",
            "",
            "Symptoms:",
            booking.symptoms or "No symptom summary recorded.",
            "",
            "AI Recommendation:",
            booking.ai_summary or "AI routing summary unavailable.",
            "",
            f"Suggested specialties: {specializations}",
            "",
            "Next Steps:",
            booking.next_steps or "Review patient on arrival and continue care transition.",
        ]
    )


def build_transfer_summary(booking, target_hospital):
    return (
        f"PDF-style clinical summary prepared for {booking.patient_name} and shared with "
        f"{target_hospital.name} to support faster diagnosis and continuity of care."
    )


def resolve_coordinates(location, latitude=None, longitude=None):
    if latitude is not None and longitude is not None:
        return latitude, longitude

    normalized_location = (location or "").strip().lower()
    if not normalized_location:
        return None, None

    direct_match = LOCATION_COORDINATES.get(normalized_location)
    if direct_match:
        return direct_match

    for known_location, coordinates in LOCATION_COORDINATES.items():
        if known_location in normalized_location or normalized_location in known_location:
            return coordinates

    return None, None


def calculate_distance_km(source_lat, source_lng, target_lat, target_lng):
    if None in {source_lat, source_lng, target_lat, target_lng}:
        return 0

    radius = 6371
    lat_delta = radians(target_lat - source_lat)
    lng_delta = radians(target_lng - source_lng)
    source_lat_rad = radians(source_lat)
    target_lat_rad = radians(target_lat)

    haversine = (
        sin(lat_delta / 2) ** 2
        + cos(source_lat_rad) * cos(target_lat_rad) * sin(lng_delta / 2) ** 2
    )

    return 2 * radius * asin(sqrt(haversine))
