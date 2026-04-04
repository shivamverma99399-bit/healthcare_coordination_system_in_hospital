import logging

import requests
from django.conf import settings

from .models import Hospital


logger = logging.getLogger(__name__)
TOKEN_URL = "https://outpost.mapmyindia.com/api/security/oauth/token"
NEARBY_URL = "https://atlas.mapmyindia.com/api/places/nearby/json"
REQUEST_TIMEOUT_SECONDS = 10


def get_access_token():
    client_id = getattr(settings, "MAPMYINDIA_CLIENT_ID", "")
    client_secret = getattr(settings, "MAPMYINDIA_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None

    try:
        response = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json().get("access_token")
    except (requests.RequestException, ValueError):
        logger.exception("Unable to fetch MapMyIndia access token.")
        return None


def get_nearby_hospitals(lat, lng, radius=5000):
    token = get_access_token()
    if not token:
        return []

    try:
        response = requests.get(
            NEARBY_URL,
            headers={"Authorization": f"Bearer {token}"},
            params={
                "keywords": "hospital",
                "refLocation": f"{lat},{lng}",
                "radius": radius,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError):
        logger.exception("Unable to fetch nearby hospitals from MapMyIndia.")
        return []

    hospitals = []

    for place in payload.get("suggestedLocations", []):
        place_id = place.get("eLoc")
        if not place_id:
            continue

        name = (place.get("placeName") or "Nearby Hospital").strip()
        hospital_lat = place.get("latitude")
        hospital_lng = place.get("longitude")
        location = (place.get("placeAddress") or name).strip()

        hospital_obj, created = Hospital.objects.get_or_create(
            place_id=place_id,
            defaults={
                "name": name,
                "location": location,
                "latitude": hospital_lat,
                "longitude": hospital_lng,
                "total_beds": 20,
                "available_beds": 10,
                "total_icu": 5,
                "available_icu": 1,
                "emergency_available": True,
                "avg_wait_time": 15,
            },
        )

        if not created:
            updated_fields = []
            if hospital_obj.name != name:
                hospital_obj.name = name
                updated_fields.append("name")
            if hospital_obj.location != location:
                hospital_obj.location = location
                updated_fields.append("location")
            if hospital_obj.latitude != hospital_lat:
                hospital_obj.latitude = hospital_lat
                updated_fields.append("latitude")
            if hospital_obj.longitude != hospital_lng:
                hospital_obj.longitude = hospital_lng
                updated_fields.append("longitude")
            if updated_fields:
                hospital_obj.save(update_fields=updated_fields)

        hospitals.append(
            {
                "id": hospital_obj.id,
                "name": hospital_obj.name,
                "lat": hospital_obj.latitude,
                "lng": hospital_obj.longitude,
                "location": hospital_obj.location,
                "distance": place.get("distance"),
            }
        )

    return hospitals
