from django.contrib.auth import logout
from django.db.models import Q
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Booking, Doctor, Hospital, InterHospitalTransfer, SosAlert
from .permissions import IsHospitalAdmin, IsPatientUser
from .serializers import (
    AdminHospitalSerializer,
    AnalyzeSymptomsSerializer,
    BookingCreateSerializer,
    BookingRecordSerializer,
    DoctorDirectorySerializer,
    HospitalRecommendationSerializer,
    HospitalAdminProfileSerializer,
    LoginSerializer,
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
    get_demo_access_profiles,
    get_hospital_recommendations,
    normalize_specialization_tag,
    serialize_access_session,
)


class DemoAccountsView(APIView):
    def get(self, request):
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
            .select_related("hospital", "doctor")
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


class AdminOverviewView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        admin_profile = request.user.hospital_admin_profile
        managed_hospital = admin_profile.hospital

        records = (
            Booking.objects.filter(hospital=managed_hospital)
            .select_related("doctor", "hospital")
            .prefetch_related("transfers")
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
                "profile": HospitalAdminProfileSerializer(admin_profile).data,
                "managed_hospital": AdminHospitalSerializer(managed_hospital).data,
                "network_hospitals": AdminHospitalSerializer(network_hospitals, many=True).data,
                "analytics": {
                    "active_records": records.count(),
                    "active_sos_alerts": alerts.filter(status="active").count(),
                    "outbound_transfers": outbound.count(),
                    "inbound_transfers": inbound.count(),
                },
                "patient_records": BookingRecordSerializer(records[:12], many=True).data,
                "alerts": SosAlertSerializer(alerts[:8], many=True).data,
                "transfers": {
                    "outbound": TransferSerializer(outbound[:8], many=True).data,
                    "inbound": TransferSerializer(inbound[:8], many=True).data,
                },
            },
            status=status.HTTP_200_OK,
        )


class AdminHospitalUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def patch(self, request, hospital_id):
        admin_profile = request.user.hospital_admin_profile
        if admin_profile.hospital_id != hospital_id:
            return Response(
                {"detail": "You can only update your assigned hospital."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AdminHospitalSerializer(admin_profile.hospital, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminPatientRecordUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def patch(self, request, booking_id):
        admin_profile = request.user.hospital_admin_profile
        booking = Booking.objects.filter(id=booking_id).select_related("hospital").first()
        if not booking:
            return Response({"detail": "Patient record not found."}, status=status.HTTP_404_NOT_FOUND)
        if booking.hospital_id != admin_profile.hospital_id:
            return Response(
                {"detail": "You can only update records for your assigned hospital."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PatientRecordUpdateSerializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(BookingRecordSerializer(booking).data, status=status.HTTP_200_OK)


class AdminTransferView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        managed_hospital = request.user.hospital_admin_profile.hospital
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
        admin_profile = request.user.hospital_admin_profile
        serializer = TransferCreateSerializer(
            data=request.data,
            context={"admin_profile": admin_profile},
        )
        serializer.is_valid(raise_exception=True)

        booking = serializer.validated_data["booking"]
        target_hospital = serializer.validated_data["target_hospital"]
        transfer = InterHospitalTransfer.objects.create(
            booking=booking,
            source_hospital=admin_profile.hospital,
            target_hospital=target_hospital,
            created_by=admin_profile,
            report_title=f"{booking.patient_name} continuity of care report",
            report_body=build_transfer_report(booking, admin_profile.hospital, target_hospital),
            report_format="PDF",
            summary=build_transfer_summary(booking, target_hospital),
            share_mode=serializer.validated_data["share_mode"],
            access_scope="Limited clinical view",
            receiving_team=serializer.validated_data.get("receiving_team", ""),
            status="access_granted",
        )
        booking.status = "transferred"
        booking.save(update_fields=["status"])
        return Response(TransferSerializer(transfer).data, status=status.HTTP_201_CREATED)
