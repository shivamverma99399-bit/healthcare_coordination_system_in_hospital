import random
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Availability, Booking, Doctor, Hospital, MedicalDocument, SosAlert


class Command(BaseCommand):
    help = "Seed realistic hospital, doctor, and availability data for local development."

    HOSPITALS = [
        {
            "name": "AIIMS Trauma Centre",
            "location": "New Delhi",
            "latitude": 28.5672,
            "longitude": 77.2100,
            "distance_km": 4,
            "beds_range": (12, 20),
            "icu_range": (3, 5),
            "wait_range": (10, 18),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Neurologist",
                "Orthopedic",
                "Pulmonologist",
            ],
        },
        {
            "name": "Fortis Escorts Heart Institute",
            "location": "Okhla, Delhi",
            "latitude": 28.5619,
            "longitude": 77.2749,
            "distance_km": 6,
            "beds_range": (9, 16),
            "icu_range": (2, 4),
            "wait_range": (12, 20),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Cardiologist",
                "Cardiologist",
                "Pulmonologist",
            ],
        },
        {
            "name": "Apollo Hospital",
            "location": "Sarita Vihar, Delhi",
            "latitude": 28.5402,
            "longitude": 77.2837,
            "distance_km": 8,
            "beds_range": (10, 18),
            "icu_range": (2, 5),
            "wait_range": (10, 22),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Cardiologist",
                "Neurologist",
                "Pediatrician",
                "Pulmonologist",
            ],
        },
        {
            "name": "Max Super Speciality Hospital",
            "location": "Saket, Delhi",
            "latitude": 28.5245,
            "longitude": 77.2066,
            "distance_km": 7,
            "beds_range": (8, 15),
            "icu_range": (1, 4),
            "wait_range": (14, 24),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Neurologist",
                "Orthopedic",
                "Dermatologist",
            ],
        },
        {
            "name": "Medanta The Medicity",
            "location": "Gurugram",
            "latitude": 28.4388,
            "longitude": 77.0405,
            "distance_km": 10,
            "beds_range": (6, 13),
            "icu_range": (1, 3),
            "wait_range": (18, 30),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Cardiologist",
                "Orthopedic",
                "Pediatrician",
            ],
        },
        {
            "name": "Manipal Hospital",
            "location": "Dwarka, Delhi",
            "latitude": 28.5921,
            "longitude": 77.0460,
            "distance_km": 9,
            "beds_range": (5, 12),
            "icu_range": (1, 3),
            "wait_range": (18, 28),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Pulmonologist",
                "Orthopedic",
                "Pediatrician",
            ],
        },
        {
            "name": "Sir Ganga Ram Hospital",
            "location": "Rajinder Nagar, Delhi",
            "latitude": 28.6386,
            "longitude": 77.1894,
            "distance_km": 3,
            "beds_range": (11, 19),
            "icu_range": (2, 5),
            "wait_range": (10, 18),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Cardiologist",
                "Neurologist",
                "Pulmonologist",
            ],
        },
        {
            "name": "BLK-Max Super Speciality Hospital",
            "location": "Pusa Road, Delhi",
            "latitude": 28.6434,
            "longitude": 77.1897,
            "distance_km": 2,
            "beds_range": (13, 20),
            "icu_range": (3, 5),
            "wait_range": (8, 16),
            "emergency_available": True,
            "doctor_specializations": [
                "General Physician",
                "Cardiologist",
                "Orthopedic",
                "Dermatologist",
            ],
        },
        {
            "name": "Artemis Hospital",
            "location": "Sector 51, Gurugram",
            "latitude": 28.4338,
            "longitude": 77.1055,
            "distance_km": 10,
            "beds_range": (4, 10),
            "icu_range": (0, 2),
            "wait_range": (20, 32),
            "emergency_available": False,
            "doctor_specializations": [
                "General Physician",
                "Pulmonologist",
                "Dermatologist",
                "Pediatrician",
            ],
        },
        {
            "name": "Yashoda Super Speciality Hospital",
            "location": "Kaushambi, Ghaziabad",
            "latitude": 28.6476,
            "longitude": 77.3176,
            "distance_km": 9,
            "beds_range": (5, 11),
            "icu_range": (0, 2),
            "wait_range": (18, 30),
            "emergency_available": False,
            "doctor_specializations": [
                "General Physician",
                "Neurologist",
                "Orthopedic",
                "Pediatrician",
            ],
        },
    ]

    DOCTOR_NAMES = [
        "Dr. Priya Sharma",
        "Dr. Arjun Mehta",
        "Dr. Neha Reddy",
        "Dr. Rahul Verma",
        "Dr. Kavya Nair",
        "Dr. Rohan Iyer",
        "Dr. Sneha Kapoor",
        "Dr. Vivek Bansal",
        "Dr. Meera Joshi",
        "Dr. Aditya Rao",
        "Dr. Aisha Khan",
        "Dr. Sandeep Menon",
        "Dr. Pooja Malhotra",
        "Dr. Nikhil Gupta",
        "Dr. Ishita Sinha",
        "Dr. Karan Arora",
        "Dr. Tanvi Kulkarni",
        "Dr. Aman Chawla",
    ]

    SPECIALIZATIONS = [
        ("General Physician", "MBBS, MD"),
        ("Cardiologist", "MBBS, DM Cardiology"),
        ("Neurologist", "MBBS, DM Neurology"),
        ("Orthopedic", "MBBS, MS Orthopedics"),
        ("Dermatologist", "MBBS, MD Dermatology"),
        ("Pulmonologist", "MBBS, MD Pulmonology"),
        ("Pediatrician", "MBBS, MD Pediatrics"),
    ]

    SHIFT_WINDOWS = [
        (time(9, 0), time(13, 0)),
        (time(10, 0), time(16, 0)),
        (time(11, 0), time(17, 0)),
        (time(12, 0), time(18, 0)),
    ]

    QUALIFICATION_BY_SPECIALIZATION = dict(SPECIALIZATIONS)

    def handle(self, *args, **options):
        self.stdout.write("Seeding data...")

        with transaction.atomic():
            self._clear_existing_data()
            hospital_count, doctor_count = self._seed_hospitals_and_doctors()

        self.stdout.write(f"Created {hospital_count} hospitals and {doctor_count} doctors")

    def _clear_existing_data(self):
        MedicalDocument.objects.all().delete()
        Booking.objects.all().delete()
        Availability.objects.all().delete()
        Doctor.objects.all().delete()
        SosAlert.objects.all().delete()
        Hospital.objects.all().delete()

    def _seed_hospitals_and_doctors(self):
        doctor_name_pool = self.DOCTOR_NAMES[:]
        random.shuffle(doctor_name_pool)

        created_hospitals = 0
        created_doctors = 0

        for hospital_data in self.HOSPITALS:
            available_beds = random.randint(*hospital_data["beds_range"])
            available_icu = random.randint(*hospital_data["icu_range"])
            total_beds = max(available_beds + random.randint(55, 120), 80)
            total_icu = max(available_icu + random.randint(6, 16), 8)
            hospital = Hospital.objects.create(
                name=hospital_data["name"],
                location=f"{hospital_data['location']} ({hospital_data['distance_km']} km)",
                latitude=hospital_data["latitude"],
                longitude=hospital_data["longitude"],
                total_beds=total_beds,
                available_beds=available_beds,
                total_icu=total_icu,
                available_icu=available_icu,
                emergency_available=hospital_data["emergency_available"],
                opd_load=random.randint(4, 24),
                avg_wait_time=random.randint(*hospital_data["wait_range"]),
            )
            created_hospitals += 1

            hospital_specializations = hospital_data["doctor_specializations"]

            for index, specialization in enumerate(hospital_specializations):
                if not doctor_name_pool:
                    doctor_name_pool = self.DOCTOR_NAMES[:]
                    random.shuffle(doctor_name_pool)

                doctor = Doctor.objects.create(
                    hospital=hospital,
                    name=doctor_name_pool.pop(),
                    specialization=specialization,
                    qualification=self.QUALIFICATION_BY_SPECIALIZATION[specialization],
                    available=index < 2 or random.choice([True, True, False]),
                )
                created_doctors += 1
                self._create_availability_slots(doctor)

        return created_hospitals, created_doctors

    def _create_availability_slots(self, doctor):
        start_time, end_time = random.choice(self.SHIFT_WINDOWS)

        # Keep unavailable doctors visible but less likely to dominate the detail page.
        days_to_seed = 3 if doctor.available else 1

        for day_offset in range(days_to_seed):
            slot_date = date.today() + timedelta(days=day_offset)
            slot_start = start_time
            max_slots = 6 if doctor.available else 2
            created_slots = 0

            while slot_start < end_time and created_slots < max_slots:
                slot_end = (datetime.combine(slot_date, slot_start) + timedelta(minutes=30)).time()
                Availability.objects.create(
                    doctor=doctor,
                    date=slot_date,
                    start_time=slot_start,
                    end_time=slot_end,
                    is_booked=False,
                )
                slot_start = slot_end
                created_slots += 1
