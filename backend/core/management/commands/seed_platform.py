"""Idempotent bootstrap: first platform super admin, default subscription plans and platform-wide tariffs."""
import os
from django.core.management.base import BaseCommand
from apps.accounts.models import User
from apps.communities.models import SubscriptionPlan
from core.roles import Role


class Command(BaseCommand):
    def handle(self, *args, **opts):
        if not User.objects.filter(role=Role.PLATFORM_SUPER_ADMIN).exists():
            email = os.getenv("PLATFORM_ADMIN_EMAIL", "admin@wtr.gh")
            pwd = os.getenv("PLATFORM_ADMIN_PASSWORD", "ChangeMe123!")
            User.objects.create_superuser(email=email, password=pwd, full_name=os.getenv("PLATFORM_ADMIN_NAME", "Platform Administrator"))
            self.stdout.write(f"Created platform super admin {email}")
        for name, price, maxc, feats in (("Starter", 0, 500, ["Billing", "Payments", "Customer portal"]),
                                         ("Standard", 350, 3000, ["Billing", "Payments", "Customer portal", "Mobile meter reading", "Infrastructure"]),
                                         ("Enterprise", 900, 50000, ["Everything", "IoT meters", "Priority support"])):
            SubscriptionPlan.objects.get_or_create(name=name, defaults={"monthly_price": price, "max_customers": maxc, "features": feats})
        # Tariffs are deliberately NOT seeded platform-wide: each community defines its own pricing.
        self.stdout.write(self.style.SUCCESS("Platform seed complete."))
