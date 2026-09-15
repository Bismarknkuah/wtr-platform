from django.conf import settings
from django.db import models
from core.models import TenantModel


class Document(TenantModel):
    class Category(models.TextChoices):
        CUSTOMER_AGREEMENT = "CUSTOMER_AGREEMENT", "Customer agreement"
        CONNECTION_FORM = "CONNECTION_FORM", "Connection form"
        METER_INSTALLATION = "METER_INSTALLATION", "Meter installation document"
        MAINTENANCE_REPORT = "MAINTENANCE_REPORT", "Maintenance report"
        WATER_QUALITY_REPORT = "WATER_QUALITY_REPORT", "Water-quality report"
        RECEIPT = "RECEIPT", "Payment receipt"
        OFFICIAL_NOTICE = "OFFICIAL_NOTICE", "Official notice"
        POLICY = "POLICY", "Community policy"
        OTHER = "OTHER", "Other"

    title = models.CharField(max_length=150)
    category = models.CharField(max_length=25, choices=Category.choices, default=Category.OTHER)
    customer = models.ForeignKey("customers.Customer", null=True, blank=True, on_delete=models.CASCADE, related_name="documents")
    asset = models.ForeignKey("infrastructure.Asset", null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")
    file = models.FileField(upload_to="documents/%Y/%m/", null=True, blank=True)
    external_url = models.URLField(blank=True, help_text="Link to a file stored in Drive/S3/Cloudinary (recommended on Railway, whose disk is ephemeral)")
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    is_public_to_customer = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
