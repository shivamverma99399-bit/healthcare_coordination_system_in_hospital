from django.contrib import admin
from .models import Hospital, Doctor, Booking


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'available_beds', 'available_icu', 'opd_load')


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('name', 'specialization', 'hospital', 'available')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('patient_name', 'hospital', 'token_number', 'urgency', 'expected_time')