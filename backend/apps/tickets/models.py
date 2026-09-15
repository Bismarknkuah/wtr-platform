from django.conf import settings
from django.db import models
from core.models import TenantModel


class ServiceRequest(TenantModel):
    class Category(models.TextChoices):
        NO_WATER = "NO_WATER", "No water"
        METER_FAULT = "METER_FAULT", "Meter fault / damaged"
        LEAK = "LEAK", "Leak"
        LOW_PRESSURE = "LOW_PRESSURE", "Low pressure"
        WATER_QUALITY = "WATER_QUALITY", "Dirty / smelly water"
        ILLEGAL_CONNECTION = "ILLEGAL_CONNECTION", "Illegal connection / tampering"
        BILL_DISPUTE = "BILL_DISPUTE", "Bill is incorrect"
        NEW_CONNECTION = "NEW_CONNECTION", "New connection request"
        DISCONNECTION = "DISCONNECTION", "Disconnection request"
        METER_REPLACEMENT = "METER_REPLACEMENT", "Meter replacement request"
        CONTACT_UPDATE = "CONTACT_UPDATE", "Update contact information"
        OTHER = "OTHER", "Other"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        ASSIGNED = "ASSIGNED", "Assigned"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        RESOLVED = "RESOLVED", "Resolved (awaiting confirmation)"
        CLOSED = "CLOSED", "Closed"
        CANCELLED = "CANCELLED", "Cancelled"

    ticket_number = models.CharField(max_length=20, unique=True, editable=False)
    customer = models.ForeignKey("customers.Customer", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    title = models.CharField(max_length=150)
    description = models.TextField()
    location = models.CharField(max_length=200, blank=True)
    town = models.ForeignKey("communities.Town", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    # Public reports (via the community's QR / link) have no user account behind them.
    source = models.CharField(max_length=12, default="STAFF", choices=[("STAFF", "Staff"), ("PORTAL", "Customer portal"), ("PUBLIC", "Public link / QR")])
    reporter_name = models.CharField(max_length=120, blank=True)
    reporter_phone = models.CharField(max_length=30, blank=True)
    photo = models.ImageField(upload_to="tickets/%Y/%m/", null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    meter = models.ForeignKey("meters.Meter", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    bill = models.ForeignKey("billing.Bill", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    raised_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets_raised")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets_assigned")
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    satisfaction_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    satisfaction_comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.ticket_number} – {self.title}"

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            from core.ids import ticket_number
            self.ticket_number = ticket_number()
        super().save(*args, **kwargs)


class TicketComment(TenantModel):
    ticket = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    body = models.TextField()
    is_internal = models.BooleanField(default=False, help_text="Internal notes are hidden from the customer")

    class Meta:
        ordering = ["created_at"]
