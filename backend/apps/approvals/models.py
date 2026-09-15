from django.conf import settings
from django.db import models
from core.models import TenantModel


class ApprovalRequest(TenantModel):
    class Type(models.TextChoices):
        BILL_ADJUSTMENT = "BILL_ADJUSTMENT", "Bill adjustment"
        REFUND = "REFUND", "Refund"
        TARIFF_CHANGE = "TARIFF_CHANGE", "Customer tariff change"
        METER_REPLACEMENT = "METER_REPLACEMENT", "Meter replacement"
        CUSTOMER_DEACTIVATION = "CUSTOMER_DEACTIVATION", "Customer deactivation"
        DEBT_WRITE_OFF = "DEBT_WRITE_OFF", "Debt write-off"
        DISCONNECTION = "DISCONNECTION", "Disconnection"
        RECONNECTION = "RECONNECTION", "Reconnection"
        PAYMENT_CORRECTION = "PAYMENT_CORRECTION", "Manual payment correction (reversal)"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        EXECUTED = "EXECUTED", "Executed"
        FAILED = "FAILED", "Execution failed"

    request_type = models.CharField(max_length=25, choices=Type.choices)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="approval_requests")
    target_model = models.CharField(max_length=40, blank=True)
    target_id = models.CharField(max_length=40, blank=True)
    target_label = models.CharField(max_length=200, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="approvals_reviewed")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    execution_result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_request_type_display()} – {self.target_label}"
