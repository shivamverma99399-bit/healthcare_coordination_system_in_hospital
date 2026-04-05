from datetime import date, time
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import (
    Availability,
    Booking,
    Doctor,
    Hospital,
    HospitalAdminProfile,
    MedicalDocument,
    PatientProfile,
    SosAlert,
    UserProfile,
)


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
        self.assertEqual(booking.status, "pending")

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

    def test_patient_login_rejects_invalid_phone_number(self):
        response = self.client.post(
            "/api/auth/login",
            {
                "role": "patient",
                "email": "asha@example.com",
                "password": "secret123",
                "phone": "12345",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["phone"][0], "Mobile number must be exactly 10 digits.")

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

    def test_admin_overview_includes_booked_appointments_for_managed_hospital(self):
        patient_user = User.objects.create_user(
            username="patient3@example.com",
            email="patient3@example.com",
            password="secret123",
        )
        patient_profile = PatientProfile.objects.create(
            user=patient_user,
            full_name="Patient Three",
            city="Delhi",
            phone="8080808080",
        )
        booking = Booking.objects.create(
            patient=patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Patient Three",
            phone="8080808080",
            symptoms="High fever",
            ai_summary="Observation required.",
            urgency="urgent",
            status="scheduled",
        )

        admin_user = User.objects.create_user(
            username="overview.admin@example.com",
            email="overview.admin@example.com",
            password="adminpass123",
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=self.city_hospital)
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.get(
            "/api/admin/overview",
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analytics"]["appointments"], 1)
        self.assertEqual(len(response.data["appointments"]), 1)
        self.assertEqual(response.data["appointments"][0]["id"], booking.id)
        self.assertEqual(response.data["appointments"][0]["patient_full_name"], "Patient Three")
        self.assertEqual(response.data["patient_records"][0]["symptoms"], "High fever")

    def test_admin_can_create_patient_record_for_existing_hospital_patient(self):
        patient_user = User.objects.create_user(
            username="patient4@example.com",
            email="patient4@example.com",
            password="secret123",
        )
        patient_profile = PatientProfile.objects.create(
            user=patient_user,
            full_name="Patient Four",
            city="Delhi",
            phone="7070707070",
        )
        Booking.objects.create(
            patient=patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Patient Four",
            phone="7070707070",
            symptoms="Headache",
            ai_summary="Initial appointment",
            urgency="normal",
            status="scheduled",
        )

        admin_user = User.objects.create_user(
            username="record.admin@example.com",
            email="record.admin@example.com",
            password="adminpass123",
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=self.city_hospital)
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.post(
            "/api/admin/patient-records",
            {
                "patient_id": patient_profile.id,
                "symptoms": "Follow-up headache and dizziness",
                "ai_summary": "MRI advised",
                "next_steps": "Upload scan reports and review in 3 days.",
                "urgency": "urgent",
                "status": "under_review",
            },
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["patient_full_name"], "Patient Four")
        self.assertEqual(response.data["ai_summary"], "MRI advised")
        created_record = Booking.objects.get(id=response.data["id"])
        self.assertEqual(created_record.hospital, self.city_hospital)
        self.assertEqual(created_record.patient, patient_profile)
        self.assertIsNone(created_record.doctor)

    def test_patient_can_cancel_own_appointment(self):
        booking = Booking.objects.create(
            patient=self.authenticated_patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Authenticated Patient",
            phone="9000000000",
            symptoms="Fever",
            urgency="normal",
            status="pending",
        )
        self.slot.is_booked = True
        self.slot.save(update_fields=["is_booked"])

        response = self.client.patch(
            f"/api/patient/appointments/{booking.id}/status",
            {"status": "cancelled"},
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        self.slot.refresh_from_db()
        self.assertEqual(booking.status, "cancelled")
        self.assertFalse(self.slot.is_booked)

    def test_patient_can_delete_own_record(self):
        booking = Booking.objects.create(
            patient=self.authenticated_patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Authenticated Patient",
            phone="9000000000",
            symptoms="Fever",
            urgency="normal",
            status="pending",
        )
        self.slot.is_booked = True
        self.slot.save(update_fields=["is_booked"])

        response = self.client.delete(
            f"/api/patient/records/{booking.id}",
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Booking.objects.filter(id=booking.id).exists())
        self.slot.refresh_from_db()
        self.assertFalse(self.slot.is_booked)

    def test_admin_can_accept_appointment_only_for_managed_hospital(self):
        patient_user = User.objects.create_user(
            username="patient5@example.com",
            email="patient5@example.com",
            password="secret123",
        )
        patient_profile = PatientProfile.objects.create(
            user=patient_user,
            full_name="Patient Five",
            city="Delhi",
            phone="6060606060",
        )
        booking = Booking.objects.create(
            patient=patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Patient Five",
            phone="6060606060",
            symptoms="Chest pain",
            urgency="urgent",
            status="pending",
        )

        admin_user = User.objects.create_user(
            username="accept.admin@example.com",
            email="accept.admin@example.com",
            password="adminpass123",
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=self.city_hospital)
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.patch(
            f"/api/admin/appointments/{booking.id}/status",
            {"status": "accepted"},
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "accepted")

    def test_admin_profile_endpoint_returns_logged_in_profile(self):
        admin_user = User.objects.create_user(
            username="profile.admin@example.com",
            email="profile.admin@example.com",
            password="adminpass123",
            first_name="Profile",
            last_name="Admin",
        )
        HospitalAdminProfile.objects.create(
            user=admin_user,
            hospital=self.city_hospital,
            admin_id="ADM-201",
        )
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.get(
            "/api/admin/profile",
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Profile Admin")
        self.assertEqual(response.data["admin_id"], "ADM-201")
        self.assertEqual(response.data["hospital_id"], self.city_hospital.id)

    def test_admin_profile_update_changes_only_own_profile(self):
        admin_user = User.objects.create_user(
            username="update.admin@example.com",
            email="update.admin@example.com",
            password="adminpass123",
            first_name="Old",
            last_name="Name",
        )
        profile = HospitalAdminProfile.objects.create(
            user=admin_user,
            hospital=self.city_hospital,
            admin_id="ADM-301",
        )
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.put(
            "/api/admin/profile",
            {
                "name": "New Admin",
                "admin_id": "ADM-999",
                "hospital": self.remote_hospital.id,
            },
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 200)
        profile.refresh_from_db()
        admin_user.refresh_from_db()
        self.assertEqual(profile.admin_id, "ADM-999")
        self.assertEqual(profile.hospital, self.remote_hospital)
        self.assertEqual(admin_user.get_full_name(), "New Admin")

    def test_patient_document_upload_preview_and_delete_round_trip(self):
        upload = SimpleUploadedFile(
            "lab-report.pdf",
            b"%PDF-1.4 patient report",
            content_type="application/pdf",
        )

        upload_response = self.client.post(
            "/api/patient/documents",
            {"files": [upload]},
            format="multipart",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(upload_response.status_code, 201)
        document_id = upload_response.data[0]["id"]
        self.assertTrue(MedicalDocument.objects.filter(id=document_id).exists())

        dashboard_response = self.client.get(
            "/api/patient/dashboard",
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(len(dashboard_response.data["documents"]), 1)
        self.assertEqual(dashboard_response.data["documents"][0]["source"], "patient")

        download_response = self.client.get(
            f"/api/documents/{document_id}/download",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(download_response.headers["Content-Type"], "application/pdf")

        delete_response = self.client.delete(
            f"/api/patient/documents/{document_id}",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(MedicalDocument.objects.filter(id=document_id).exists())

    def test_admin_uploaded_record_document_is_visible_to_patient(self):
        booking = Booking.objects.create(
            patient=self.authenticated_patient_profile,
            hospital=self.city_hospital,
            doctor=self.general_doctor,
            availability=self.slot,
            patient_name="Authenticated Patient",
            phone="9000000000",
            symptoms="Fever",
            urgency="normal",
            status="under_review",
        )

        admin_user = User.objects.create_user(
            username="documents.admin@example.com",
            email="documents.admin@example.com",
            password="adminpass123",
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=self.city_hospital)
        admin_token = Token.objects.create(user=admin_user)

        upload = SimpleUploadedFile(
            "discharge-summary.pdf",
            b"%PDF-1.4 discharge summary",
            content_type="application/pdf",
        )
        upload_response = self.client.post(
            f"/api/admin/patient-records/{booking.id}/documents",
            {"files": [upload]},
            format="multipart",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(upload_response.status_code, 201)
        document_id = upload_response.data[0]["id"]

        dashboard_response = self.client.get(
            "/api/patient/dashboard",
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(len(dashboard_response.data["documents"]), 1)
        self.assertEqual(dashboard_response.data["documents"][0]["id"], document_id)
        self.assertEqual(dashboard_response.data["documents"][0]["source"], "admin")

    def test_patient_can_delete_own_sos_alert(self):
        alert = SosAlert.objects.create(
            patient=self.authenticated_patient_profile,
            hospital=self.city_hospital,
            message="Need immediate help",
            contact_name="Patient",
            urgency="critical",
            location_context="Delhi",
        )

        response = self.client.delete(
            f"/api/patient/sos-alerts/{alert.id}",
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(SosAlert.objects.filter(id=alert.id).exists())

    def test_admin_register_creates_user_profile_hospital_and_token(self):
        response = self.client.post(
            "/api/auth/admin-register",
            {
                "email": "admin.register@example.com",
                "password": "adminpass123",
                "phone": "9898989898",
                "hospital_name": "Sunrise Care",
                "city": "Mumbai",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["message"], "Admin created")

        user = User.objects.get(email="admin.register@example.com")
        hospital = Hospital.objects.get(admin=user)
        token = Token.objects.get(key=response.data["token"])

        self.assertEqual(token.user, user)
        self.assertTrue(user.check_password("adminpass123"))
        self.assertNotEqual(user.password, "adminpass123")
        self.assertEqual(user.profile.role, "hospital")
        self.assertEqual(user.profile.phone, "9898989898")
        self.assertEqual(hospital.name, "Sunrise Care")
        self.assertEqual(hospital.city, "Mumbai")
        self.assertEqual(hospital.location, "Mumbai")
        self.assertTrue(HospitalAdminProfile.objects.filter(user=user, hospital=hospital).exists())

    def test_admin_register_rejects_duplicate_email(self):
        User.objects.create_user(
            username="duplicate@example.com",
            email="duplicate@example.com",
            password="secret123",
        )

        response = self.client.post(
            "/api/auth/admin-register",
            {
                "email": "duplicate@example.com",
                "password": "adminpass123",
                "phone": "9898989898",
                "hospital_name": "Duplicate Hospital",
                "city": "Delhi",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["email"][0], "A user with this email already exists.")

    def test_hospital_admin_can_update_own_hospital(self):
        admin_user = User.objects.create_user(
            username="hospital.update@example.com",
            email="hospital.update@example.com",
            password="adminpass123",
        )
        UserProfile.objects.create(user=admin_user, role="hospital", phone="9000011111")
        managed_hospital = Hospital.objects.create(
            admin=admin_user,
            name="Update Hospital",
            city="Delhi",
            location="Delhi",
            total_beds=10,
            available_beds=4,
            total_icu=2,
            available_icu=1,
            emergency_available=True,
            opd_load=0,
            avg_wait_time=15,
        )
        HospitalAdminProfile.objects.create(user=admin_user, hospital=managed_hospital)
        admin_token = Token.objects.create(user=admin_user)

        response = self.client.put(
            "/api/hospital/update",
            {
                "beds": 22,
                "icu_beds": 5,
            },
            format="json",
            **self.auth_headers(admin_token),
        )

        self.assertEqual(response.status_code, 200)
        managed_hospital.refresh_from_db()
        self.assertEqual(response.data["beds"], 22)
        self.assertEqual(response.data["icu_beds"], 5)
        self.assertEqual(managed_hospital.available_beds, 22)
        self.assertEqual(managed_hospital.available_icu, 5)
        self.assertEqual(managed_hospital.total_beds, 22)
        self.assertEqual(managed_hospital.total_icu, 5)

    def test_patient_cannot_update_hospital(self):
        response = self.client.put(
            "/api/hospital/update",
            {
                "beds": 12,
                "icu_beds": 2,
            },
            format="json",
            **self.auth_headers(self.authenticated_patient_token),
        )

        self.assertEqual(response.status_code, 403)
