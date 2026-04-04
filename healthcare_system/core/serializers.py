from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from .models import (
    Availability,
    Booking,
    Doctor,
    Hospital,
    HospitalAdminProfile,
    InterHospitalTransfer,
    PatientProfile,
    SosAlert,
)
from .services import maybe_seed_demo_access_profiles, normalize_specialization_tag


def format_slot_label(slot):
    return slot.start_time.strftime("%I:%M %p").lstrip("0")


def format_timing_range(slots):
    if not slots:
        return "No slots available"

    first_slot = slots[0]
    last_slot = slots[-1]
    start_label = first_slot.start_time.strftime("%I:%M %p").lstrip("0")
    end_label = last_slot.end_time.strftime("%I:%M %p").lstrip("0")
    return f"{start_label} - {end_label}"


class LoginSerializer(serializers.Serializer):
    ROLE_CHOICES = [
        ("patient", "Patient"),
        ("hospital_admin", "Hospital Admin"),
    ]

    role = serializers.ChoiceField(choices=ROLE_CHOICES)
    email = serializers.EmailField()
    password = serializers.CharField()
    full_name = serializers.CharField(required=False, allow_blank=True, default="")
    city = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    emergency_contact = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        role = attrs["role"]
        email = attrs["email"].strip().lower()
        password = attrs["password"]
        maybe_seed_demo_access_profiles(email, role=role)

        if role == "patient":
            raw_phone = str(attrs.get("phone", ""))
            phone_digits = "".join(char for char in raw_phone if char.isdigit())
            if raw_phone.strip() and len(phone_digits) != 10:
                raise serializers.ValidationError({"phone": "Mobile number must be exactly 10 digits."})
            attrs["phone"] = phone_digits
            attrs["user"] = self._resolve_patient_user(
                email=email,
                password=password,
                full_name=attrs.get("full_name", ""),
                city=attrs.get("city", ""),
                phone=attrs.get("phone", ""),
                emergency_contact=attrs.get("emergency_contact", ""),
            )
            return attrs

        user = self._authenticate_admin_user(email, password)
        if not user or not (getattr(user, "is_superuser", False) or hasattr(user, "hospital_admin_profile")):
            raise serializers.ValidationError({"detail": "Invalid hospital admin credentials."})

        attrs["user"] = user
        return attrs

    def _authenticate_admin_user(self, identifier, password):
        user = authenticate(username=identifier, password=password)
        if user:
            return user

        existing_users = list(User.objects.filter(email__iexact=identifier).order_by("id")[:2])
        if len(existing_users) > 1:
            raise serializers.ValidationError(
                {"detail": "Multiple admin accounts were found for this email address."}
            )

        matched_user = existing_users[0] if existing_users else None
        if not matched_user:
            return None

        return authenticate(username=matched_user.username, password=password)

    def _resolve_patient_user(self, email, password, full_name, city, phone, emergency_contact):
        existing_users = list(
            User.objects.filter(email=email, patient_profile__isnull=False).order_by("id")[:2]
        )
        if len(existing_users) > 1:
            raise serializers.ValidationError(
                {"detail": "Multiple patient accounts were found for this email address."}
            )

        user = existing_users[0] if existing_users else None
        if user:
            if not user.check_password(password):
                raise serializers.ValidationError({"detail": "Invalid patient credentials."})
            self._sync_patient_user(user, email, full_name)
            self._sync_patient_profile(user, full_name, city, phone, emergency_contact)
            return user

        if len(phone) != 10:
            raise serializers.ValidationError({"phone": "Mobile number must be exactly 10 digits."})

        resolved_name = full_name.strip() or self._name_from_email(email)
        first_name, _, last_name = resolved_name.partition(" ")
        user = User.objects.create_user(
            username=self._build_patient_username(email),
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        self._sync_patient_profile(user, resolved_name, city, phone, emergency_contact)
        return user

    def _name_from_email(self, email):
        local_part = email.split("@", 1)[0]
        cleaned = local_part.replace(".", " ").replace("_", " ").replace("-", " ").strip()
        return cleaned.title() or "Demo Patient"

    def _build_patient_username(self, email):
        candidates = [email, f"patient__{email}"]
        for candidate in candidates:
            if len(candidate) <= 150 and not User.objects.filter(username=candidate).exists():
                return candidate

        suffix = 1
        while True:
            candidate = f"patient{suffix}__{email}"
            if len(candidate) <= 150 and not User.objects.filter(username=candidate).exists():
                return candidate
            suffix += 1

    def _sync_patient_user(self, user, email, full_name):
        resolved_name = full_name.strip() or user.get_full_name() or self._name_from_email(email)
        first_name, _, last_name = resolved_name.partition(" ")
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

        if changed:
            user.save()

    def _sync_patient_profile(self, user, full_name, city, phone, emergency_contact):
        resolved_name = full_name.strip() or user.get_full_name() or self._name_from_email(user.email)
        PatientProfile.objects.update_or_create(
            user=user,
            defaults={
                "full_name": resolved_name,
                "city": city or "Delhi",
                "phone": phone or getattr(getattr(user, "patient_profile", None), "phone", "") or "9999999999",
                "emergency_contact": emergency_contact or "Demo Emergency Contact",
            },
        )


class AnalyzeSymptomsSerializer(serializers.Serializer):
    symptoms = serializers.CharField(max_length=500)
    location = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    urgency = serializers.ChoiceField(
        choices=Booking.URGENCY_CHOICES,
        required=False,
        default="normal",
    )


class HospitalRecommendationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    hospital_name = serializers.CharField()
    distance = serializers.FloatField()
    beds_available = serializers.IntegerField()
    icu_available = serializers.IntegerField()
    ai_score = serializers.IntegerField()
    ai_reason = serializers.CharField()
    specialization = serializers.ListField(child=serializers.CharField())
    location = serializers.CharField(required=False)
    emergency_available = serializers.BooleanField(required=False)
    score_breakdown = serializers.DictField(child=serializers.IntegerField(), required=False)
    care_pathway = serializers.CharField(required=False)
    next_steps = serializers.ListField(child=serializers.CharField(), required=False)


class DoctorDirectorySerializer(serializers.ModelSerializer):
    timing = serializers.SerializerMethodField()
    time_slots = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = ["id", "name", "specialization", "timing", "available", "time_slots"]

    def _open_slots(self, obj):
        if not hasattr(self, "_open_slot_cache"):
            self._open_slot_cache = {}

        if obj.pk not in self._open_slot_cache:
            slots = [
                slot
                for slot in obj.availabilities.all()
                if not slot.is_booked
            ]
            slots.sort(key=lambda slot: (slot.date, slot.start_time))
            self._open_slot_cache[obj.pk] = slots

        return self._open_slot_cache[obj.pk]

    def get_timing(self, obj):
        return format_timing_range(self._open_slots(obj))

    def get_time_slots(self, obj):
        return [format_slot_label(slot) for slot in self._open_slots(obj)]

    def get_available(self, obj):
        return obj.available and bool(self._open_slots(obj))


class BookingCreateSerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField()
    patient_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    time = serializers.CharField(max_length=30)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    urgency = serializers.ChoiceField(
        choices=Booking.URGENCY_CHOICES,
        required=False,
        default="normal",
    )
    symptoms = serializers.CharField(required=False, allow_blank=True, default="")
    ai_summary = serializers.CharField(required=False, allow_blank=True, default="")
    recommended_specializations = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    next_steps = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        doctor = Doctor.objects.filter(id=attrs["doctor_id"]).select_related("hospital").first()
        if not doctor:
            raise serializers.ValidationError({"doctor_id": "Doctor not found."})

        availability = self._match_availability(doctor, attrs["time"])
        if not availability:
            raise serializers.ValidationError(
                {"time": "Selected doctor is not available at that time."}
            )

        patient_profile = self.context["patient_profile"]
        attrs["doctor"] = doctor
        attrs["hospital"] = doctor.hospital
        attrs["availability"] = availability
        attrs["patient"] = patient_profile
        attrs["patient_name"] = attrs["patient_name"] or patient_profile.full_name
        attrs["phone"] = attrs["phone"] or patient_profile.phone or "9999999999"
        return attrs

    def _match_availability(self, doctor, time_label):
        normalized = str(time_label).strip().upper().replace(".", "")
        slots = doctor.availabilities.filter(is_booked=False).order_by("date", "start_time")

        for slot in slots:
            candidates = {
                slot.start_time.strftime("%I:%M %p").lstrip("0").upper(),
                slot.start_time.strftime("%I %p").lstrip("0").upper(),
            }
            if normalized in candidates:
                return slot

        return None

    def create(self, validated_data):
        with transaction.atomic():
            availability = (
                Availability.objects.select_for_update()
                .select_related("doctor", "doctor__hospital")
                .get(pk=validated_data["availability"].pk)
            )
            if availability.is_booked:
                raise serializers.ValidationError(
                    {"time": "Selected doctor is no longer available at that time."}
                )

            booking = Booking.objects.create(
                patient=validated_data["patient"],
                hospital=validated_data["hospital"],
                doctor=validated_data["doctor"],
                availability=availability,
                patient_name=validated_data["patient_name"],
                phone=validated_data["phone"],
                urgency=validated_data["urgency"],
                symptoms=validated_data.get("symptoms", ""),
                ai_summary=validated_data.get("ai_summary", ""),
                recommended_specializations=validated_data.get("recommended_specializations", []),
                next_steps=validated_data.get("next_steps", ""),
                status="pending",
            )

            availability.is_booked = True
            availability.save(update_fields=["is_booked"])

        return booking


class AdminHospitalSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        data = {
            "total_beds": attrs.get("total_beds", instance.total_beds if instance else 0),
            "available_beds": attrs.get("available_beds", instance.available_beds if instance else 0),
            "total_icu": attrs.get("total_icu", instance.total_icu if instance else 0),
            "available_icu": attrs.get("available_icu", instance.available_icu if instance else 0),
        }

        errors = {}
        for field_name, value in data.items():
            if value < 0:
                errors[field_name] = "Value cannot be negative."

        if data["available_beds"] > data["total_beds"]:
            errors["available_beds"] = "Available beds cannot exceed total beds."
        if data["available_icu"] > data["total_icu"]:
            errors["available_icu"] = "Available ICU beds cannot exceed total ICU beds."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    class Meta:
        model = Hospital
        fields = [
            "id",
            "name",
            "location",
            "available_beds",
            "available_icu",
            "total_beds",
            "total_icu",
            "emergency_available",
            "avg_wait_time",
            "opd_load",
        ]


class BookingRecordSerializer(serializers.ModelSerializer):
    patient_full_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.name", read_only=True)
    appointment_date = serializers.SerializerMethodField()
    transfer_count = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "patient_name",
            "patient_full_name",
            "phone",
            "hospital_name",
            "doctor_name",
            "urgency",
            "status",
            "symptoms",
            "ai_summary",
            "recommended_specializations",
            "next_steps",
            "token_number",
            "appointment_date",
            "created_at",
            "transfer_count",
        ]

    def get_patient_full_name(self, obj):
        return getattr(obj.patient, "full_name", "") or obj.patient_name

    def get_appointment_date(self, obj):
        if obj.availability_id and obj.availability:
            return obj.availability.date
        return obj.created_at.date()

    def get_transfer_count(self, obj):
        return obj.transfers.count()


class PatientRecordUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ["status", "ai_summary", "next_steps"]


class PatientAppointmentStatusSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(choices=[("cancelled", "Cancelled")])

    class Meta:
        model = Booking
        fields = ["status"]


class AdminAppointmentStatusSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(choices=[("accepted", "Accepted"), ("rejected", "Rejected")])

    class Meta:
        model = Booking
        fields = ["status"]


class PatientDirectorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = ["id", "full_name", "phone", "city"]


class AdminPatientRecordCreateSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    symptoms = serializers.CharField(required=False, allow_blank=True, default="")
    ai_summary = serializers.CharField(required=False, allow_blank=True, default="")
    next_steps = serializers.CharField(required=False, allow_blank=True, default="")
    urgency = serializers.ChoiceField(
        choices=Booking.URGENCY_CHOICES,
        required=False,
        default="normal",
    )
    status = serializers.ChoiceField(
        choices=Booking.STATUS_CHOICES,
        required=False,
        default="under_review",
    )

    def validate(self, attrs):
        patient = PatientProfile.objects.filter(id=attrs["patient_id"]).first()
        if not patient:
            raise serializers.ValidationError({"patient_id": "Patient not found."})

        hospital = self.context["hospital"]
        can_access_all_patients = self.context.get("can_access_all_patients", False)
        if not can_access_all_patients and not Booking.objects.filter(
            patient=patient,
            hospital=hospital,
        ).exists():
            raise serializers.ValidationError(
                {"patient_id": "Select a patient who already has an appointment with your hospital."}
            )

        attrs["patient"] = patient
        return attrs

    def create(self, validated_data):
        patient = validated_data["patient"]
        hospital = self.context["hospital"]
        return Booking.objects.create(
            patient=patient,
            hospital=hospital,
            patient_name=patient.full_name,
            phone=patient.phone or "9999999999",
            symptoms=validated_data.get("symptoms", ""),
            ai_summary=validated_data.get("ai_summary", ""),
            next_steps=validated_data.get("next_steps", ""),
            urgency=validated_data.get("urgency", "normal"),
            status=validated_data.get("status", "under_review"),
            recommended_specializations=[],
        )


class SosAlertSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)

    class Meta:
        model = SosAlert
        fields = [
            "id",
            "hospital",
            "hospital_name",
            "patient_name",
            "message",
            "contact_name",
            "urgency",
            "location_context",
            "status",
            "created_at",
        ]


class SosAlertCreateSerializer(serializers.Serializer):
    hospital_id = serializers.IntegerField(required=False, allow_null=True)
    message = serializers.CharField(max_length=255)
    contact_name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    urgency = serializers.ChoiceField(
        choices=Booking.URGENCY_CHOICES,
        required=False,
        default="critical",
    )
    location_context = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        hospital_id = attrs.get("hospital_id")
        if hospital_id is None:
            attrs["hospital"] = None
            return attrs

        hospital = Hospital.objects.filter(id=hospital_id).first()
        if not hospital:
            raise serializers.ValidationError({"hospital_id": "Hospital not found."})

        attrs["hospital"] = hospital
        return attrs

    def create(self, validated_data):
        patient_profile = self.context.get("patient_profile")
        return SosAlert.objects.create(
            patient=patient_profile,
            hospital=validated_data.get("hospital"),
            message=validated_data["message"],
            contact_name=validated_data.get("contact_name", ""),
            urgency=validated_data.get("urgency", "critical"),
            location_context=validated_data.get("location_context", ""),
        )


class TransferCreateSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    target_hospital_id = serializers.IntegerField()
    share_mode = serializers.ChoiceField(choices=InterHospitalTransfer.SHARE_MODE_CHOICES)
    receiving_team = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        admin_hospital = self.context.get("admin_hospital")
        can_access_all_hospitals = self.context.get("can_access_all_hospitals", False)
        booking = (
            Booking.objects.filter(id=attrs["booking_id"])
            .select_related("hospital", "doctor", "patient")
            .first()
        )
        if not booking:
            raise serializers.ValidationError({"booking_id": "Patient record not found."})
        if not can_access_all_hospitals and (not admin_hospital or booking.hospital_id != admin_hospital.id):
            raise serializers.ValidationError(
                {"booking_id": "You can only share records from your managed hospital."}
            )

        target_hospital = Hospital.objects.filter(id=attrs["target_hospital_id"]).first()
        if not target_hospital:
            raise serializers.ValidationError({"target_hospital_id": "Hospital not found."})
        source_hospital_id = admin_hospital.id if admin_hospital else booking.hospital_id
        if target_hospital.id == source_hospital_id:
            raise serializers.ValidationError(
                {"target_hospital_id": "Choose a different hospital for inter-hospital sharing."}
            )

        attrs["booking"] = booking
        attrs["target_hospital"] = target_hospital
        return attrs


class TransferSerializer(serializers.ModelSerializer):
    source_hospital_name = serializers.CharField(source="source_hospital.name", read_only=True)
    target_hospital_name = serializers.CharField(source="target_hospital.name", read_only=True)
    patient_name = serializers.CharField(source="booking.patient_name", read_only=True)

    class Meta:
        model = InterHospitalTransfer
        fields = [
            "id",
            "patient_name",
            "source_hospital_name",
            "target_hospital_name",
            "report_title",
            "report_body",
            "report_format",
            "summary",
            "share_mode",
            "access_scope",
            "receiving_team",
            "status",
            "created_at",
            "updated_at",
        ]


class HospitalAdminProfileSerializer(serializers.ModelSerializer):
    hospital = AdminHospitalSerializer(read_only=True)
    hospital_id = serializers.IntegerField(source="hospital.id", read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    name = serializers.SerializerMethodField()

    class Meta:
        model = HospitalAdminProfile
        fields = ["name", "admin_id", "title", "hospital", "hospital_id", "hospital_name"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class HospitalAdminProfileUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=200)
    hospital = serializers.PrimaryKeyRelatedField(queryset=Hospital.objects.all())

    class Meta:
        model = HospitalAdminProfile
        fields = ["name", "admin_id", "hospital"]

    def validate_admin_id(self, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Admin ID is required.")

        existing = HospitalAdminProfile.objects.exclude(id=self.instance.id).filter(admin_id__iexact=cleaned)
        if existing.exists():
            raise serializers.ValidationError("This admin ID is already in use.")
        return cleaned

    def update(self, instance, validated_data):
        resolved_name = validated_data.pop("name", "").strip()
        hospital = validated_data.pop("hospital", None)

        if resolved_name:
            first_name, _, last_name = resolved_name.partition(" ")
            user = instance.user
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=["first_name", "last_name"])

        if hospital is not None:
            instance.hospital = hospital

        instance.admin_id = validated_data.get("admin_id", instance.admin_id)
        instance.save(update_fields=["hospital", "admin_id"] if hospital is not None else ["admin_id"])
        return instance
