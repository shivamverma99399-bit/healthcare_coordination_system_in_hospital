from django.db import models


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

    def __str__(self):
        return self.name

class Doctor(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    specialization = models.CharField(max_length=200)
    qualification = models.CharField(max_length=200)
    available = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.specialization}"


from django.utils import timezone
from datetime import timedelta

class Booking(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    patient_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=15)

    token_number = models.IntegerField(blank=True, null=True)
    expected_time = models.TimeField(blank=True, null=True)

    urgency = models.CharField(
        max_length=10,
        choices=[('normal','Normal'),('urgent','Urgent'),('critical','Critical')]
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.token_number:
            count = Booking.objects.filter(hospital=self.hospital).count()
            self.token_number = count + 1

            wait = count * 10
            t = timezone.now() + timedelta(minutes=wait)
            self.expected_time = t.time()

            self.hospital.opd_load += 1
            self.hospital.save()

        super().save(*args, **kwargs)