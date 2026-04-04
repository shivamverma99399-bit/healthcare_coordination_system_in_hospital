from django.conf import settings
from django.contrib.auth import logout
from django.db.models import Q
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Booking, Doctor, Hospital, InterHospitalTransfer, PatientProfile, SosAlert
from .permissions import IsHospitalAdmin, IsPatientUser
from .serializers import (
    AdminHospitalSerializer,
    AdminAppointmentStatusSerializer,
    HospitalAdminProfileUpdateSerializer,
    AdminPatientRecordCreateSerializer,
    AnalyzeSymptomsSerializer,
    BookingCreateSerializer,
    BookingRecordSerializer,
    DoctorDirectorySerializer,
    HospitalRecommendationSerializer,
    HospitalAdminProfileSerializer,
    LoginSerializer,
    PatientAppointmentStatusSerializer,
    PatientDirectorySerializer,
    PatientRecordUpdateSerializer,
    SosAlertCreateSerializer,
    SosAlertSerializer,
    TransferCreateSerializer,
    TransferSerializer,
)
from .services import (
    analyze_symptoms,
    build_transfer_report,
    build_transfer_summary,
    get_admin_access_scope,
    get_demo_access_profiles,
    get_hospital_recommendations,
    normalize_specialization_tag,
    serialize_access_session,
)


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class DemoAccountsView(APIView):
    def get(self, request):
        if not getattr(settings, "DEMO_ACCOUNTS_ENABLED", False):
            return Response({"detail": "Demo accounts are disabled."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"accounts": get_demo_access_profiles()}, status=status.HTTP_200_OK)


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            serialize_access_session(user, token.key),
            status=status.HTTP_200_OK,
        )


class SessionView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            serialize_access_session(request.user, request.auth.key),
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.auth:
            request.auth.delete()
        logout(request)
        return Response({"status": "logged_out"}, status=status.HTTP_200_OK)


class AnalyzeSymptomsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AnalyzeSymptomsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        analysis = analyze_symptoms(
            symptoms=serializer.validated_data["symptoms"],
            location=serializer.validated_data["location"],
            urgency=serializer.validated_data["urgency"],
        )
        return Response(analysis, status=status.HTTP_200_OK)


class HospitalRecommendationsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        symptoms = request.query_params.get("symptoms", "")
        location = request.query_params.get("location", "")
        urgency = request.query_params.get("urgency", "normal")
        latitude = self._parse_float(request.query_params.get("lat"))
        longitude = self._parse_float(request.query_params.get("lng"))
        max_distance = self._parse_float(request.query_params.get("distance"))
        require_icu = str(request.query_params.get("icu", "")).lower() == "true"
        specialization = request.query_params.get("specialization")

        if not symptoms.strip():
            return Response(
                {"detail": "The 'symptoms' query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ranked_results = get_hospital_recommendations(
            symptoms=symptoms,
            location=location,
            urgency=urgency,
            max_distance=max_distance,
            require_icu=require_icu,
            specialization=specialization,
            latitude=latitude,
            longitude=longitude,
        )

        serializer = HospitalRecommendationSerializer(ranked_results[:6], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _parse_float(self, value):
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


class DoctorsByHospitalView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hospital_id = request.query_params.get("id") or request.query_params.get("hospital_id")
        specialization = request.query_params.get("specialization")

        if not hospital_id:
            return Response(
                {"detail": "The 'id' query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        doctors = Doctor.objects.filter(hospital_id=hospital_id).prefetch_related("availabilities")
        if specialization:
            normalized_tag = normalize_specialization_tag(specialization)
            if normalized_tag:
                doctors = [
                    doctor
                    for doctor in doctors
                    if normalize_specialization_tag(doctor.specialization) == normalized_tag
                ]

        serializer = DoctorDirectorySerializer(doctors, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BookAppointmentView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsPatientUser]

    def post(self, request):
        serializer = BookingCreateSerializer(
            data=request.data,
            context={"patient_profile": request.user.patient_profile},
        )
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        return Response(
            {
                "status": "confirmed",
                "booking_status": booking.status,
                "booking_id": booking.id,
                "doctor_name": booking.doctor.name if booking.doctor else "",
                "hospital_name": booking.hospital.name,
                "time": booking.availability.start_time.strftime("%I:%M %p").lstrip("0")
                if booking.availability
                else "",
                "token_number": booking.token_number,
            },
            status=status.HTTP_200_OK,
        )


class PatientDashboardView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsPatientUser]

    def get(self, request):
        patient_profile = request.user.patient_profile
        bookings = (
            Booking.objects.filter(patient=patient_profile)
            .select_related("hospital", "doctor", "availability")
            .prefetch_related("transfers")
        )
        alerts_queryset = SosAlert.objects.filter(patient=patient_profile).select_related("hospital")
        alerts = alerts_queryset[:8]

        return Response(
            {
                "profile": {
                    "full_name": patient_profile.full_name,
                    "city": patient_profile.city,
                    "phone": patient_profile.phone,
                    "emergency_contact": patient_profile.emergency_contact,
                },
                "stats": {
                    "appointments": bookings.count(),
                    "active_alerts": alerts_queryset.filter(status="active").count(),
                    "network_hospitals": Hospital.objects.count(),
                    "emergency_ready": Hospital.objects.filter(emergency_available=True).count(),
                },
                "history": BookingRecordSerializer(bookings[:8], many=True).data,
                "alerts": SosAlertSerializer(alerts, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class PatientSosAlertView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsPatientUser]

    def post(self, request):
        serializer = SosAlertCreateSerializer(
            data=request.data,
            context={"patient_profile": request.user.patient_profile},
        )
        serializer.is_valid(raise_exception=True)
        alert = serializer.save()
        return Response(SosAlertSerializer(alert).data, status=status.HTTP_201_CREATED)


class PatientAppointmentStatusView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsPatientUser]

    def patch(self, request, booking_id):
        booking = self._get_owned_booking(request.user, booking_id)
        if not booking:
            return Response({"detail": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PatientAppointmentStatusSerializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        self._release_slot_if_needed(booking)
        return Response(BookingRecordSerializer(booking).data, status=status.HTTP_200_OK)

    def _get_owned_booking(self, user, booking_id):
        return (
            Booking.objects.filter(id=booking_id, patient=user.patient_profile)
            .select_related("availability", "hospital", "doctor", "patient")
            .first()
        )

    def _release_slot_if_needed(self, booking):
        if booking.status != "cancelled" or not booking.availability_id:
            return
        availability = booking.availability
        if availability.is_booked:
            availability.is_booked = False
            availability.save(update_fields=["is_booked"])


class PatientRecordDeleteView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsPatientUser]

    def delete(self, request, booking_id):
        booking = (
            Booking.objects.filter(id=booking_id, patient=request.user.patient_profile)
            .select_related("availability")
            .first()
        )
        if not booking:
            return Response({"detail": "Patient record not found."}, status=status.HTTP_404_NOT_FOUND)

        hospital_id = booking.hospital_id
        availability = booking.availability
        booking.delete()
        if availability and availability.is_booked:
            availability.is_booked = False
            availability.save(update_fields=["is_booked"])
        Booking.update_hospital_queue(hospital_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminOverviewView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        admin_scope = get_admin_access_scope(request.user)
        managed_hospital = admin_scope["hospital"] if admin_scope else None
        if not managed_hospital:
            return Response(
                {"detail": "No hospital is configured for this admin account."},
                status=status.HTTP_404_NOT_FOUND,
            )

        records = (
            Booking.objects.filter(hospital=managed_hospital)
            .select_related("doctor", "hospital", "patient", "availability")
            .prefetch_related("transfers")
        )
        appointments = records.exclude(availability__isnull=True)
        patients = (
            PatientProfile.objects.filter(bookings__hospital=managed_hospital)
            .distinct()
            .order_by("full_name")
        )
        alerts = (
            SosAlert.objects.filter(Q(hospital=managed_hospital) | Q(hospital__isnull=True))
            .select_related("hospital", "patient")
            .order_by("-created_at")
        )
        outbound = InterHospitalTransfer.objects.filter(source_hospital=managed_hospital).select_related(
            "booking",
            "source_hospital",
            "target_hospital",
        )
        inbound = InterHospitalTransfer.objects.filter(target_hospital=managed_hospital).select_related(
            "booking",
            "source_hospital",
            "target_hospital",
        )
        network_hospitals = Hospital.objects.exclude(id=managed_hospital.id)

        return Response(
            {
                "profile": (
                    HospitalAdminProfileSerializer(admin_scope["profile"]).data
                    if admin_scope and admin_scope["profile"]
                    else {
                        "title": admin_scope["title"] if admin_scope else "Hospital Admin",
                        "hospital": AdminHospitalSerializer(managed_hospital).data,
                    }
                ),
                "managed_hospital": AdminHospitalSerializer(managed_hospital).data,
                "network_hospitals": AdminHospitalSerializer(network_hospitals, many=True).data,
                "analytics": {
                    "active_records": records.count(),
                    "appointments": appointments.count(),
                    "active_sos_alerts": alerts.filter(status="active").count(),
                    "outbound_transfers": outbound.count(),
                    "inbound_transfers": inbound.count(),
                },
                "appointments": BookingRecordSerializer(appointments[:12], many=True).data,
                "patient_records": BookingRecordSerializer(records[:12], many=True).data,
                "patient_options": PatientDirectorySerializer(patients, many=True).data,
                "alerts": SosAlertSerializer(alerts[:8], many=True).data,
                "transfers": {
                    "outbound": TransferSerializer(outbound[:8], many=True).data,
                    "inbound": TransferSerializer(inbound[:8], many=True).data,
                },
            },
            status=status.HTTP_200_OK,
        )


class AdminProfileView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        admin_scope = get_admin_access_scope(request.user)
        if not admin_scope or not admin_scope["profile"]:
            return Response(
                {"detail": "Admin profile is not configured."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            HospitalAdminProfileSerializer(admin_scope["profile"]).data,
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        admin_scope = get_admin_access_scope(request.user)
        if not admin_scope or not admin_scope["profile"]:
            return Response(
                {"detail": "Admin profile is not configured."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = HospitalAdminProfileUpdateSerializer(
            admin_scope["profile"],
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        admin_scope["profile"].refresh_from_db()
        return Response(
            HospitalAdminProfileSerializer(admin_scope["profile"]).data,
            status=status.HTTP_200_OK,
        )


class AdminHospitalUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def patch(self, request, hospital_id):
        admin_scope = get_admin_access_scope(request.user, hospital_id=hospital_id)
        if not admin_scope:
            return Response(
                {"detail": "You do not have hospital admin access."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not admin_scope["is_superuser"] and admin_scope["hospital"].id != hospital_id:
            return Response(
                {"detail": "You can only update your assigned hospital."},
                status=status.HTTP_403_FORBIDDEN,
            )

        hospital = Hospital.objects.filter(id=hospital_id).first() if admin_scope["is_superuser"] else admin_scope["hospital"]
        if not hospital:
            return Response(
                {"detail": "Hospital not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AdminHospitalSerializer(hospital, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminPatientRecordUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def patch(self, request, booking_id):
        admin_scope = get_admin_access_scope(request.user)
        booking = Booking.objects.filter(id=booking_id).select_related("hospital").first()
        if not booking:
            return Response({"detail": "Patient record not found."}, status=status.HTTP_404_NOT_FOUND)
        if admin_scope and not admin_scope["is_superuser"] and booking.hospital_id != admin_scope["hospital"].id:
            return Response(
                {"detail": "You can only update records for your assigned hospital."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PatientRecordUpdateSerializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        booking.refresh_from_db()
        return Response(BookingRecordSerializer(booking).data, status=status.HTTP_200_OK)


class AdminPatientRecordListCreateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def post(self, request):
        admin_scope = get_admin_access_scope(request.user)
        managed_hospital = admin_scope["hospital"] if admin_scope else None
        if not managed_hospital:
            return Response(
                {"detail": "No hospital is configured for this admin account."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AdminPatientRecordCreateSerializer(
            data=request.data,
            context={
                "hospital": managed_hospital,
                "can_access_all_patients": bool(admin_scope and admin_scope["is_superuser"]),
            },
        )
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        return Response(BookingRecordSerializer(booking).data, status=status.HTTP_201_CREATED)


class AdminAppointmentStatusUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def patch(self, request, booking_id):
        admin_scope = get_admin_access_scope(request.user)
        booking = (
            Booking.objects.filter(id=booking_id)
            .select_related("hospital", "availability", "doctor", "patient")
            .first()
        )
        if not booking:
            return Response({"detail": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)
        if not admin_scope or booking.hospital_id != admin_scope["hospital"].id:
            return Response(
                {"detail": "You can only update appointments for your assigned hospital."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AdminAppointmentStatusSerializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        if booking.status == "rejected" and booking.availability_id:
            availability = booking.availability
            if availability.is_booked:
                availability.is_booked = False
                availability.save(update_fields=["is_booked"])
        return Response(BookingRecordSerializer(booking).data, status=status.HTTP_200_OK)


class AdminTransferView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        admin_scope = get_admin_access_scope(request.user)
        managed_hospital = admin_scope["hospital"] if admin_scope else None
        if not managed_hospital:
            return Response(
                {"detail": "No hospital is configured for this admin account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        outgoing = InterHospitalTransfer.objects.filter(source_hospital=managed_hospital).select_related(
            "booking",
            "source_hospital",
            "target_hospital",
        )
        incoming = InterHospitalTransfer.objects.filter(target_hospital=managed_hospital).select_related(
            "booking",
            "source_hospital",
            "target_hospital",
        )
        return Response(
            {
                "outbound": TransferSerializer(outgoing, many=True).data,
                "inbound": TransferSerializer(incoming, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        admin_scope = get_admin_access_scope(request.user)
        if not admin_scope:
            return Response(
                {"detail": "You do not have hospital admin access."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = TransferCreateSerializer(
            data=request.data,
            context={
                "admin_hospital": admin_scope["hospital"],
                "admin_profile": admin_scope["profile"],
                "can_access_all_hospitals": admin_scope["is_superuser"],
            },
        )
        serializer.is_valid(raise_exception=True)

        booking = serializer.validated_data["booking"]
        target_hospital = serializer.validated_data["target_hospital"]
        source_hospital = admin_scope["hospital"] or booking.hospital
        transfer = InterHospitalTransfer.objects.create(
            booking=booking,
            source_hospital=source_hospital,
            target_hospital=target_hospital,
            created_by=admin_scope["profile"],
            report_title=f"{booking.patient_name} continuity of care report",
            report_body=build_transfer_report(booking, source_hospital, target_hospital),
            report_format="PDF",
            summary=build_transfer_summary(booking, target_hospital),
            share_mode=serializer.validated_data["share_mode"],
            access_scope="Limited clinical view",
            receiving_team=serializer.validated_data.get("receiving_team", ""),
            status="shared",
        )
        booking.status = "transferred"
        booking.save(update_fields=["status"])
        return Response(TransferSerializer(transfer).data, status=status.HTTP_201_CREATED)
