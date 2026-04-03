from datetime import date, timedelta, time

from django.core.management.base import BaseCommand

from core.models import Availability, Doctor, Hospital


class Command(BaseCommand):
    help = "Seed demo hospitals, doctors, and availability slots for local testing."

    def handle(self, *args, **options):
        hospitals_data = [
            {
                "name": "Metro General Hospital",
                "location": "Connaught Place, Delhi",
                "latitude": 28.6315,
                "longitude": 77.2167,
                "total_beds": 120,
                "available_beds": 30,
                "total_icu": 18,
                "available_icu": 5,
                "emergency_available": True,
                "opd_load": 4,
                "avg_wait_time": 12,
                "doctors": [
                    ("Dr. Kavya Sharma", "General Physician", "MBBS, MD"),
                    ("Dr. Rohit Iyer", "Cardiologist", "MBBS, DM Cardiology"),
                ],
            },
            {
                "name": "Sunrise Care Clinic",
                "location": "South Extension, Delhi",
                "latitude": 28.5680,
                "longitude": 77.2197,
                "total_beds": 80,
                "available_beds": 14,
                "total_icu": 10,
                "available_icu": 2,
                "emergency_available": True,
                "opd_load": 7,
                "avg_wait_time": 18,
                "doctors": [
                    ("Dr. Neha Rao", "General Physician", "MBBS"),
                    ("Dr. Sandeep Menon", "Pulmonologist", "MBBS, MD"),
                ],
            },
        ]

        for hospital_data in hospitals_data:
            doctors_data = hospital_data.pop("doctors")
            hospital, _ = Hospital.objects.get_or_create(
                name=hospital_data["name"],
                defaults=hospital_data,
            )

            for doctor_name, specialization, qualification in doctors_data:
                doctor, _ = Doctor.objects.get_or_create(
                    hospital=hospital,
                    name=doctor_name,
                    defaults={
                        "specialization": specialization,
                        "qualification": qualification,
                        "available": True,
                    },
                )

                for day_offset in range(2):
                    slot_date = date.today() + timedelta(days=day_offset)
                    for start_hour in (10, 11, 12):
                        Availability.objects.get_or_create(
                            doctor=doctor,
                            date=slot_date,
                            start_time=time(start_hour, 0),
                            defaults={"end_time": time(start_hour, 30)},
                        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
