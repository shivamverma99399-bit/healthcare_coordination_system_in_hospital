from django.core.management.base import BaseCommand

from core.services import ensure_demo_access_profiles


class Command(BaseCommand):
    help = "Seed demo patient and hospital admin access profiles."

    def handle(self, *args, **options):
        accounts = ensure_demo_access_profiles()
        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(accounts)} demo access profile(s).")
        )
