import builtins
from django.conf import settings
from django.db import models
from core.models import TenantModel


class CustomerCategory(models.TextChoices):
    RESIDENTIAL = "RESIDENTIAL", "Residential"
    COMMERCIAL = "COMMERCIAL", "Commercial"
    INSTITUTIONAL = "INSTITUTIONAL", "Institutional"
    INDUSTRIAL = "INDUSTRIAL", "Industrial"
    SCHOOL = "SCHOOL", "School"
    CHURCH = "CHURCH", "Church"
    MOSQUE = "MOSQUE", "Mosque"
    PUBLIC_FACILITY = "PUBLIC_FACILITY", "Public facility"
    GOVERNMENT = "GOVERNMENT", "Government facility"


class Property(TenantModel):
    property_id = models.CharField(max_length=20, unique=True, editable=False)
    address = models.CharField(max_length=255)
    landmark = models.CharField(max_length=150, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    property_type = models.CharField(max_length=20, choices=CustomerCategory.choices, default=CustomerCategory.RESIDENTIAL)
    town = models.ForeignKey("communities.Town", null=True, blank=True, on_delete=models.SET_NULL, related_name="properties")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["property_id"]
        verbose_name_plural = "properties"

    def __str__(self):
        return f"{self.property_id} – {self.address}"

    def save(self, *args, **kwargs):
        if not self.property_id:
            from core.ids import property_id
            self.property_id = property_id()
        super().save(*args, **kwargs)


class Customer(TenantModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending connection"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        DISCONNECTED = "DISCONNECTED", "Disconnected"
        INACTIVE = "INACTIVE", "Inactive"

    customer_id = models.CharField(max_length=24, unique=True, editable=False)
    household_name = models.CharField(max_length=150)
    town = models.ForeignKey("communities.Town", null=True, blank=True, on_delete=models.SET_NULL, related_name="customers")
    contact_person = models.CharField(max_length=120)
    phone = models.CharField(max_length=30)
    alternative_phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    property = models.ForeignKey(Property, null=True, blank=True, on_delete=models.SET_NULL, related_name="customers")
    category = models.CharField(max_length=20, choices=CustomerCategory.choices, default=CustomerCategory.RESIDENTIAL)
    tariff_plan = models.ForeignKey("tariffs.TariffPlan", null=True, blank=True, on_delete=models.SET_NULL, related_name="customers")
    occupants = models.PositiveIntegerField(default=1)
    connection_date = models.DateField(null=True, blank=True)
    account_status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    outstanding_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    risk_score = models.PositiveSmallIntegerField(default=0)
    risk_level = models.CharField(max_length=10, default="LOW")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="customer_profile")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["household_name"]

    def __str__(self):
        return f"{self.household_name} ({self.customer_id})"

    def save(self, *args, **kwargs):
        if not self.customer_id:
            from core.ids import customer_id
            self.customer_id = customer_id(self.community.code)
        super().save(*args, **kwargs)

    @builtins.property
    def active_meter(self):
        return self.meters.filter(status__in=["ACTIVE", "INSTALLED", "FAULTY", "BLOCKED"]).order_by("-installation_date").first()
