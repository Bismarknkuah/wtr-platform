"""Daily housekeeping: mark overdue bills, run dunning, send maintenance reminders. Schedule on Railway (cron) or call manually."""
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.billing.services import refresh_overdue, run_dunning
from apps.communities.models import Community
from apps.infrastructure.models import Asset
from apps.notifications.services import notify_community


class Command(BaseCommand):
    def handle(self, *args, **opts):
        today = timezone.localdate()
        for c in Community.objects.filter(service_status="ACTIVE"):
            n = refresh_overdue(c)
            actions = run_dunning(c)
            due = Asset.objects.filter(community=c, next_maintenance__in=[today + timedelta(days=7), today + timedelta(days=1), today]).exclude(status="DECOMMISSIONED")
            for a in due:
                notify_community("MAINTENANCE_DUE", c, {"asset": a.name, "days": (a.next_maintenance - today).days, "date": str(a.next_maintenance)}, staff_only=True)
            self.stdout.write(f"{c.name}: {n} bills marked overdue, {len(actions)} dunning actions, {due.count()} maintenance reminders")
        self.stdout.write(self.style.SUCCESS("Daily run complete."))
