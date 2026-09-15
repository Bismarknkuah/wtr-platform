from django.conf import settings
from django.db import models
from core.models import TenantModel


class Notification(TenantModel):
    class Channel(models.TextChoices):
        SMS = "SMS", "SMS"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        EMAIL = "EMAIL", "Email"
        PORTAL = "PORTAL", "In-app"

    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    event = models.CharField(max_length=40, db_index=True)
    channel = models.CharField(max_length=10, choices=Channel.choices)
    customer = models.ForeignKey("customers.Customer", null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    recipient = models.CharField(max_length=150, blank=True)
    title = models.CharField(max_length=150)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED)
    sent_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=300, blank=True)
    is_read = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
