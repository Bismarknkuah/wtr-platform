from django.db import models
from core.models import TimeStampedModel
from apps.customers.models import CustomerCategory


class TariffPlan(TimeStampedModel):
    """A pricing plan. community=NULL means a platform-wide default plan available to every community."""
    class Mode(models.TextChoices):
        FLAT = "FLAT", "Flat rate per m³"
        TIERED = "TIERED", "Tiered (incremental blocks)"
        SLAB = "SLAB", "Slab (whole consumption priced at the band it lands in)"

    community = models.ForeignKey("communities.Community", null=True, blank=True, on_delete=models.CASCADE, related_name="tariff_plans")
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CustomerCategory.choices, default=CustomerCategory.RESIDENTIAL)
    billing_mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.TIERED)
    flat_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0, help_text="Used when billing_mode = FLAT")
    minimum_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("community", "name")]

    def __str__(self):
        return f"{self.name} [{self.get_billing_mode_display()}]"


class TariffTier(models.Model):
    plan = models.ForeignKey(TariffPlan, on_delete=models.CASCADE, related_name="tiers")
    order = models.PositiveSmallIntegerField(default=1)
    from_m3 = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    to_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, help_text="Blank = no upper limit")
    rate_per_m3 = models.DecimalField(max_digits=10, decimal_places=4, default=0, help_text="TIERED: price per m³ in this block")
    slab_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="SLAB: fixed price if consumption falls in this band")

    class Meta:
        ordering = ["plan", "order", "from_m3"]

    def __str__(self):
        return f"{self.from_m3}–{self.to_m3 or '∞'} m³"


class ServiceCharge(TimeStampedModel):
    class Type(models.TextChoices):
        SERVICE = "SERVICE", "Service charge"
        MAINTENANCE_LEVY = "MAINTENANCE_LEVY", "Maintenance levy"
        INFRASTRUCTURE_LEVY = "INFRASTRUCTURE_LEVY", "Infrastructure levy"
        OTHER = "OTHER", "Other fixed charge"

    community = models.ForeignKey("communities.Community", on_delete=models.CASCADE, related_name="service_charges")
    name = models.CharField(max_length=100)
    charge_type = models.CharField(max_length=20, choices=Type.choices, default=Type.SERVICE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    applies_to = models.JSONField(default=list, blank=True, help_text="Customer categories; empty = all")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["charge_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.amount})"
