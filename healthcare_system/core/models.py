from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Hospital(models.Model):
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200)
    place_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    total_beds = models.IntegerField()
    available_beds = models.IntegerField()
    total_icu = models.IntegerField()
    available_icu = models.IntegerField()
    emergency_available = models.BooleanField(default=True)
    opd_load = models.IntegerField(default=0)
    avg_wait_time = models.IntegerField(default=15)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PatientProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="patient_profile",
    )
    full_name = models.CharField(max_length=200)
    city = models.CharField(max_length=120, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    emergency_contact = models.CharField(max_length=120, blank=True, default="")

    def __str__(self):
        return self.full_name


class HospitalAdminProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="hospital_admin_profile",
    )
    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="admin_profiles",
    )
    title = models.CharField(max_length=120, default="Hospital Operations Admin")

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} @ {self.hospital.name}"


class Doctor(models.Model):
    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="doctors",
    )
    name = models.CharField(max_length=200)
    specialization = models.CharField(max_length=200)
    qualification = models.CharField(max_length=200)
    available = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} - {self.specialization}"


class Availability(models.Model):
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name="availabilities",
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_booked = models.BooleanField(default=False)

    class Meta:
        ordering = ["date", "start_time"]

    def __str__(self):
        return f"{self.doctor.name} - {self.date} {self.start_time}"


class Booking(models.Model):
    URGENCY_CHOICES = [
        ("normal", "Normal"),
        ("urgent", "Urgent"),
        ("critical", "Critical"),
    ]

    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("under_review", "Under Review"),
        ("transferred", "Transferred"),
        ("completed", "Completed"),
    ]

    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
    )
    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
    )
    availability = models.OneToOneField(
        Availability,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="booking",
    )
    patient_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    symptoms = models.TextField(blank=True, default="")
    ai_summary = models.TextField(blank=True, default="")
    recommended_specializations = models.JSONField(default=list, blank=True)
    token_number = models.IntegerField(blank=True, null=True)
    expected_time = models.TimeField(blank=True, null=True)
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")
    next_steps = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.token_number:
            count = Booking.objects.filter(hospital=self.hospital).count()
            self.token_number = count + 1

            wait = count * 10
            queue_time = timezone.now() + timedelta(minutes=wait)
            self.expected_time = queue_time.time()

            self.hospital.opd_load += 1
            self.hospital.save(update_fields=["opd_load"])

        super().save(*args, **kwargs)


class SosAlert(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("resolved", "Resolved"),
    ]

    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sos_alerts",
    )
    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="sos_alerts",
        null=True,
        blank=True,
    )
    message = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=120, blank=True)
    urgency = models.CharField(max_length=10, choices=Booking.URGENCY_CHOICES, default="critical")
    location_context = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"SOS {self.status} - {self.message}"


class InterHospitalTransfer(models.Model):
    SHARE_MODE_CHOICES = [
        ("email", "Encrypted Email"),
        ("api", "Secure API"),
    ]

    STATUS_CHOICES = [
        ("report_generated", "Report Generated"),
        ("shared", "Shared"),
        ("access_granted", "Access Granted"),
        ("continuity_of_care", "Continuity Of Care"),
    ]

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="transfers",
    )
    source_hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="outgoing_transfers",
    )
    target_hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="incoming_transfers",
    )
    created_by = models.ForeignKey(
        HospitalAdminProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfers",
    )
    report_title = models.CharField(max_length=200)
    report_body = models.TextField()
    report_format = models.CharField(max_length=20, default="PDF")
    summary = models.TextField(blank=True, default="")
    share_mode = models.CharField(max_length=10, choices=SHARE_MODE_CHOICES, default="api")
    access_scope = models.CharField(max_length=120, default="Limited clinical view")
    receiving_team = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="report_generated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source_hospital.name} -> {self.target_hospital.name}"
