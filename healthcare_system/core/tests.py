from datetime import date, time
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Availability, Booking, Doctor, Hospital, HospitalAdminProfile, PatientProfile


class MedPulseApiTests(APITestCase):
    def setUp(self):
        self.city_hospital = Hospital.objects.create(
            name="City Hospital",
            location="Central Delhi",
            latitude=28.6145,
            longitude=77.2092,
            total_beds=100,
            available_beds=18,
            total_icu=20,
            available_icu=3,
            emergency_available=True,
            opd_load=3,
            avg_wait_time=10,
        )
        self.remote_hospital = Hospital.objects.create(
            name="Remote Care Center",
            location="Noida Extension",
            latitude=28.6400,
            longitude=77.4300,
            total_beds=80,
            available_beds=6,
            total_icu=8,
            available_icu=0,
            emergency_available=False,
            opd_load=5,
            avg_wait_time=22,
        )
        self.general_doctor = Doctor.objects.create(
            hospital=self.city_hospital,
            name="Dr. Meera Rao",
            specialization="General Physician",
            qualification="MBBS, MD",
            available=True,
        )
        self.remote_doctor = Doctor.objects.create(
            hospital=self.remote_hospital,
            name="Dr. Kavya Jain",
            specialization="Cardiologist",
            qualification="MBBS, DM",
            available=True,
        )
        self.slot = Availability.objects.create(
            doctor=self.general_doctor,
            date=date.today(),
            start_time=time(10, 0),
            end_time=time(10, 30),
            is_booked=False,
        )
        Availability.objects.create(
            doctor=self.remote_doctor,
            date=date.today(),
            start_time=time(9, 0),
            end_time=time(9, 30),
            is_booked=False,
        )
        self.authenticated_patient_user = User.objects.create_user(
            username="authenticated.patient@example.com",
            email="authenticated.patient@example.com",
            password="secret123",
        )
        self.authenticated_patient_profile = PatientProfile.objects.create(
            user=self.authenticated_patient_user,
            full_name="Authenticated Patient",
            city="Delhi",
            phone="9000000000",
        )
        self.authenticated_patient_token = Token.objects.create(user=self.authenticated_patient_user)

    def auth_headers(self, token):
        return {"HTTP_AUTHORIZATION": f"Token {token.key}"}

    def test_patient_login_creates_profile_and_books_appointment(self):
        login_response = self.client.post(
            "/api/auth/login",
            {
                "role": "patient",
                "email": "asha@example.com",
                "password": "secret123",
                "full_name": "Asha Verma",
                "city": "Delhi",
                "phone": "9898989898",
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, 200)
        token = Token.objects.get(key=login_response.data["token"])

        booking_response = self.client.post(
            "/api/book-appointment",
            {
                "doctor_id": self.general_doctor.id,
                "time": "10:00 AM",
                "symptoms": "Fever and cough",
                "ai_summary": "General physician review suggested.",
                "recommended_specializations": ["general_physician"],
                "next_steps": "Attend OPD consultation.",
            },
            format="json",
            **self.auth_headers(token),
        )

        self.assertEqual(booking_response.status_code, 200)
        self.assertEqual(booking_response.data["status"], "confirmed")
        self.slot.refresh_from_db()
        self.assertTrue(self.slot.is_booked)
        booking = Booking.objects.get(id=booking_response.data["booking_id"])
        self.assertEqual(booking.patient.full_name, "Asha Verma")
        self.assertEqual(booking.status, "scheduled")

    def test_patient_login_rejects_wrong_password_for_existing_account(self):
        existing_user = User.objects.create_user(
            username="existing.patient@example.com",
            email="existing.patient@example.com",
            password="correct-password",
        )
        PatientProfile.objects.create(
            user=existing_user,
            full_name="Existing Patient",
            city="Delhi",
            phone="9191919191",
        )

        response = self.client.post(
            "/api/auth/login",
            {
                "role": "patient",
                "email": "existing.patient@example.com",
                "password": "wrong-password",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"][0], "Invalid patient credentials.")

    @patch("core.services.analyze_symptoms_with_gemini", return_value=None)
    def test_hospital_recommendations_include_breakdown(self, mock_gemini):
        response = self.client.get(
            "/api/hospitals/recommendations",
            {
                "symptoms": "fever and weakness",
                "location": "Delhi",
                "urgency": "normal",
                "distance": "5",
                "icu": "true",
            },
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data)
        self.assertIn("City Hospital", [item["hospital_name"] for item in response.data])
        for item in response.data:
            self.assertLessEqual(item["distance"], 5)
            self.assertGreater(item["icu_available"], 0)

        city_result = next(item for item in response.data if item["hospital_name"] == "City Hospital")
        self.assertIn("score_breakdown", city_result)
        self.assertIn("care_pathway", city_result)

    def test_hospital_recommendations_require_authentication(self):
        response = self.client.get(
            "/api/hospitals/recommendations",
            {
                "symptoms": "fever and weakness",
                "location": "Delhi",
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_patient_dashboard_returns_history(self):
        patient_user = User.objects.create_user(
            username="patient1@example.com",
            email="patient1@example.com",
            password="secret123",
        )
        patient_profile = PatientProfile.objects.create(
            user=patient_user,
            full_name="Patient One",
            city="Delhi",
            phone="9090909090",
        )
        token = Token.objects.create(user=patient_user)

        Booking.objects.create(
            patient=patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Patient One",
            phone="9090909090",
            symptoms="Fever",
            ai_summary="Review in OPD",
            recommended_specializations=["general_physician"],
            urgency="normal",
        )

        response = self.client.get(
            "/api/patient/dashboard",
            format="json",
            **self.auth_headers(token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["profile"]["full_name"], "Patient One")
        self.assertEqual(len(response.data["history"]), 1)

    def test_admin_transfer_workflow_creates_interhospital_record(self):
        patient_user = User.objects.create_user(
            username="patient2@example.com",
            email="patient2@example.com",
            password="secret123",
        )
        patient_profile = PatientProfile.objects.create(
            user=patient_user,
            full_name="Patient Two",
            city="Delhi",
            phone="9191919191",
        )
        booking = Booking.objects.create(
            patient=patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Patient Two",
            phone="9191919191",
            symptoms="Chest discomfort",
            ai_summary="Cardiology referral recommended.",
            recommended_specializations=["cardiologist"],
            urgency="urgent",
            next_steps="Refer to cardiac center.",
        )

        admin_user = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="adminpass123",
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=self.city_hospital)
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.post(
            "/api/admin/transfers",
            {
                "booking_id": booking.id,
                "target_hospital_id": self.remote_hospital.id,
                "share_mode": "api",
                "receiving_team": "Cardiology Desk",
            },
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 201)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "transferred")
        self.assertEqual(response.data["target_hospital_name"], "Remote Care Center")
        self.assertEqual(response.data["report_format"], "PDF")

    @patch("core.services.analyze_symptoms_with_gemini")
    def test_analyze_symptoms_uses_gemini_when_available(self, mock_gemini):
        mock_gemini.return_value = {
            "symptoms": "Chest pain and palpitations",
            "symptom_tags": ["chest pain", "palpitations"],
            "recommended_specializations": ["cardiologist"],
            "urgency": "urgent",
            "summary": "Cardiology review recommended.",
            "source": "gemini",
        }

        response = self.client.post(
            "/api/analyze-symptoms",
            {
                "symptoms": "Chest pain and palpitations",
                "location": "Delhi",
                "urgency": "normal",
            },
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["tags"], ["cardiologist"])
        self.assertEqual(response.data["severity"], "medium")
        self.assertIn("summary", response.data)

    def test_analyze_symptoms_requires_authentication(self):
        response = self.client.post(
            "/api/analyze-symptoms",
            {
                "symptoms": "Chest pain and palpitations",
                "location": "Delhi",
                "urgency": "normal",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_admin_hospital_update_rejects_invalid_capacity_values(self):
        admin_user = User.objects.create_user(
            username="capacity.admin@example.com",
            email="capacity.admin@example.com",
            password="adminpass123",
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=self.city_hospital)
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.patch(
            f"/api/admin/hospitals/{self.city_hospital.id}",
            {
                "available_beds": self.city_hospital.total_beds + 1,
                "available_icu": -1,
            },
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("available_beds", response.data)
        self.assertIn("available_icu", response.data)

    def test_superuser_can_login_via_email_and_access_admin_overview(self):
        superuser = User.objects.create_superuser(
            username="platform-root",
            email="root@example.com",
            password="rootpass123",
        )

        login_response = self.client.post(
            "/api/auth/login",
            {
                "role": "hospital_admin",
                "email": "root@example.com",
                "password": "rootpass123",
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.data["role"], "hospital_admin")
        self.assertTrue(login_response.data["is_superuser"])
        self.assertEqual(login_response.data["email"], superuser.email)
        self.assertEqual(
            login_response.data["profile"]["hospital"]["name"],
            self.city_hospital.name,
        )

        token = Token.objects.get(key=login_response.data["token"])
        overview_response = self.client.get(
            "/api/admin/overview",
            format="json",
            **self.auth_headers(token),
        )

        self.assertEqual(overview_response.status_code, 200)
        self.assertEqual(
            overview_response.data["managed_hospital"]["name"],
            self.city_hospital.name,
        )
