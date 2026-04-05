from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_medicaldocument"),
    ]

    operations = [
        migrations.AlterField(
            model_name="booking",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("rejected", "Rejected"),
                    ("cancelled", "Cancelled"),
                    ("scheduled", "Scheduled"),
                    ("under_review", "Under Review"),
                    ("transferred", "Transferred"),
                    ("completed", "Completed"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
