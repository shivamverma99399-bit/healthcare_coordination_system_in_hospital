from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_alter_booking_options_alter_doctor_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="hospitaladminprofile",
            name="admin_id",
            field=models.CharField(blank=True, max_length=60, null=True, unique=True),
        ),
    ]
