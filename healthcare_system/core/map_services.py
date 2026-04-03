from .models import Hospital
import requests

CLIENT_ID = "96dHZVzsAutg91LSAxiELfFj1TGwLr9xz2MtKtqeOdpVjBvq8UebxtC8uk9g56-Mz5-EfElw_XeDE6eRU5m1X57ZsIoaUJYs"
CLIENT_SECRET = "lrFxI-iSEg9Xm6x31j2k2DYF7nOjmh0rlOg8twlcolvuAL1NyA28pGC2-KdhGY22_39fAG5W2ba9DyFRk3y6AsyvqyS2ndhoqUAla7QYPeg="


def get_access_token():
    url = "https://outpost.mapmyindia.com/api/security/oauth/token"  

    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }

    res = requests.post(url, data=data).json()
    print("TOKEN RESPONSE:", res)

    return res.get("access_token")


def test_nearby():
    token = get_access_token()

    url = "https://atlas.mapmyindia.com/api/places/nearby/json"

    headers = {
        "Authorization": f"Bearer {token}"
    }

    params = {
        "keywords": "hospital",
        "refLocation": "28.6,77.2",
        "radius": 5000
    }

    res = requests.get(url, headers=headers, params=params).json()

    hospitals = []

    for place in res.get("suggestedLocations", []):
        hospitals.append({
            "place_id": place.get("eLoc"),
            "name": place.get("placeName"),
            "lat": place.get("latitude"),
            "lng": place.get("longitude"),
            "address": place.get("placeAddress"),
            "distance": place.get("distance")
        })

    print(hospitals)

def get_nearby_hospitals(lat, lng):
    token = get_access_token()

    url = "https://atlas.mapmyindia.com/api/places/nearby/json"

    headers = {
        "Authorization": f"Bearer {token}"
    }

    params = {
        "keywords": "hospital",
        "refLocation": f"{lat},{lng}",
        "radius": 5000
    }

    res = requests.get(url, headers=headers, params=params).json()

    from .models import Hospital

    hospitals = []

    for place in res.get("suggestedLocations", []):
        place_id = place.get("eLoc")
        name = place.get("placeName")
        lat = place.get("latitude")
        lng = place.get("longitude")
        address = place.get("placeAddress")

        hospital_obj, created = Hospital.objects.get_or_create(
            place_id=place_id,
            defaults={
                "name": name,
                "latitude": lat,
                "longitude": lng,
                "address": address,
                "beds_available": 10,
                "icu_available": False,
                "wait_time": 15
            }
        )

        hospitals.append({
            "id": hospital_obj.id,
            "name": hospital_obj.name,
            "lat": hospital_obj.latitude,
            "lng": hospital_obj.longitude,
            "address": hospital_obj.address,
        })
    return hospitals