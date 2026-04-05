from django.contrib import admin

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


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'available_beds', 'available_icu', 'opd_load')


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('name', 'specialization', 'hospital', 'available')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('patient_name', 'hospital', 'status', 'token_number', 'urgency', 'expected_time')


@admin.register(Availability)
class AvailabilityAdmin(admin.ModelAdmin):
    list_display = ('doctor', 'date', 'start_time', 'end_time', 'is_booked')


@admin.register(SosAlert)
class SosAlertAdmin(admin.ModelAdmin):
    list_display = ("message", "hospital", "urgency", "status", "created_at")


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "city", "phone")


@admin.register(HospitalAdminProfile)
class HospitalAdminProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "hospital", "title")


@admin.register(InterHospitalTransfer)
class InterHospitalTransferAdmin(admin.ModelAdmin):
    list_display = ("booking", "source_hospital", "target_hospital", "share_mode", "status")
