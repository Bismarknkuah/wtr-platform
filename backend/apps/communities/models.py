from django.conf import settings
from django.db import models
from core.models import TimeStampedModel


class SubscriptionPlan(TimeStampedModel):
    name = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    monthly_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_customers = models.PositiveIntegerField(default=1000)
    max_staff = models.PositiveIntegerField(default=20)
    features = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Community(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending approval"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        INACTIVE = "INACTIVE", "Inactive"

    class SystemType(models.TextChoices):
        PIPED = "PIPED", "Piped scheme"
        BOREHOLE = "BOREHOLE", "Mechanised borehole"
        SMALL_TOWN = "SMALL_TOWN", "Small-town water system"
        HANDPUMP = "HANDPUMP", "Hand-pump"
        MIXED = "MIXED", "Mixed"

    code = models.CharField(max_length=30, unique=True, editable=False)
    name = models.CharField(max_length=150)
    region = models.CharField(max_length=80)
    district = models.CharField(max_length=100)
    municipality = models.CharField(max_length=100, blank=True)
    town = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    boundary = models.JSONField(null=True, blank=True, help_text="GeoJSON polygon of the community boundary")
    contact_name = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    contact_email = models.EmailField(blank=True)
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="administered_communities")
    water_source = models.CharField(max_length=120, blank=True)
    water_system_type = models.CharField(max_length=20, choices=SystemType.choices, default=SystemType.PIPED)
    households_count = models.PositiveIntegerField(default=0)
    meters_count = models.PositiveIntegerField(default=0)
    service_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    registration_date = models.DateField(auto_now_add=True)
    subscription_plan = models.ForeignKey(SubscriptionPlan, null=True, blank=True, on_delete=models.SET_NULL, related_name="communities")
    notes = models.TextField(blank=True)
    # Anyone with this link (or its QR code) can report a water problem to this community without an account.
    # The water manager can regenerate it at any time to invalidate old posters.
    public_report_token = models.CharField(max_length=32, blank=True, db_index=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "communities"

    def __str__(self):
        return f"{self.name} ({self.code})"

    def save(self, *args, **kwargs):
        if not self.code:
            from core.ids import community_code
            self.code = community_code(self.region)
        super().save(*args, **kwargs)


class Town(models.Model):
    """
    A town, village or zone served by a community water system. A "community" in WTR is the
    utility (typically district-wide); it can serve one town or many. Customers, properties and
    service requests can be tagged with a town so the officers can see where things happen.
    """
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="towns")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, blank=True, help_text="Short code shown on IDs and reports, e.g. ABK")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    households_estimate = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("community", "name")]

    def __str__(self):
        return self.name


class CommunityRole(models.Model):
    """
    A role the community admin defines themselves — any name, any set of feature modules
    ("Zone supervisor", "Standpipe attendant", "Board member (read-only)"). Users are given
    role=CUSTOM plus a link to one of these; their permissions are the modules ticked here.
    """
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="custom_roles")
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=200, blank=True)
    modules = models.JSONField(default=list, blank=True, help_text="Module keys from core/modules.py this role may use")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("community", "name")]

    def __str__(self):
        return self.name


class CommunitySettings(TimeStampedModel):
    """Per-community business policy. Created automatically with the community."""
    class Cycle(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        BIMONTHLY = "BIMONTHLY", "Bi-monthly"
        QUARTERLY = "QUARTERLY", "Quarterly"
        CUSTOM = "CUSTOM", "Custom"

    community = models.OneToOneField(Community, on_delete=models.CASCADE, related_name="settings")
    currency = models.CharField(max_length=5, default="GHS")
    billing_cycle = models.CharField(max_length=12, choices=Cycle.choices, default=Cycle.MONTHLY)
    due_days = models.PositiveIntegerField(default=14, help_text="Days after bill issue before it is due")
    late_penalty_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    reminder_days = models.JSONField(default=list, blank=True, help_text="Days overdue at which reminders are sent, e.g. [7, 14, 21]")
    disconnection_after_days = models.PositiveIntegerField(default=45)
    disconnection_requires_approval = models.BooleanField(default=True)
    anomaly_spike_percent = models.PositiveIntegerField(default=200, help_text="Flag when consumption exceeds this % of the running average")
    anomaly_low_percent = models.PositiveIntegerField(default=30)
    zero_consumption_streak = models.PositiveIntegerField(default=3)
    notify_sms = models.BooleanField(default=True)
    notify_whatsapp = models.BooleanField(default=False)
    notify_email = models.BooleanField(default=True)
    water_loss_target_percent = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    # System settings (community admin): which feature modules each role may use, e.g.
    # {"CUSTOMER_SUPPORT": ["debt", "payments"], "TECHNICIAN": ["tickets"]} = modules switched OFF per role.
    module_access = models.JSONField(default=dict, blank=True, help_text="Modules disabled per role: {role: [module keys]}")
    # Community-wide feature switches shown/hidden for everyone (customers included).
    customer_portal_enabled = models.BooleanField(default=True)
    online_payments_enabled = models.BooleanField(default=True)
    customer_requests_enabled = models.BooleanField(default=True)
    show_usage_to_customers = models.BooleanField(default=True)

    def __str__(self):
        return f"Settings for {self.community}"
