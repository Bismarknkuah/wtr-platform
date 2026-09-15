from django.conf import settings
from django.db import models
from core.models import TenantModel


class BillingPeriod(TenantModel):
    class Frequency(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        BIMONTHLY = "BIMONTHLY", "Bi-monthly"
        QUARTERLY = "QUARTERLY", "Quarterly"
        CUSTOM = "CUSTOM", "Custom"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open (readings being collected)"
        GENERATED = "GENERATED", "Bills generated"
        CLOSED = "CLOSED", "Closed"

    name = models.CharField(max_length=80)
    frequency = models.CharField(max_length=12, choices=Frequency.choices, default=Frequency.MONTHLY)
    start_date = models.DateField()
    end_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    generated_at = models.DateTimeField(null=True, blank=True)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    bills_count = models.PositiveIntegerField(default=0)
    total_billed = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-start_date"]
        unique_together = [("community", "name")]

    def __str__(self):
        return f"{self.name} ({self.start_date} → {self.end_date})"


class Bill(TenantModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially paid"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"
        CANCELLED = "CANCELLED", "Cancelled"
        CARRIED_FORWARD = "CARRIED_FORWARD", "Carried forward into a later bill"

    invoice_number = models.CharField(max_length=30, unique=True, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="bills")
    meter = models.ForeignKey("meters.Meter", null=True, blank=True, on_delete=models.SET_NULL, related_name="bills")
    period = models.ForeignKey(BillingPeriod, null=True, blank=True, on_delete=models.SET_NULL, related_name="bills")
    reading = models.OneToOneField("meters.MeterReading", null=True, blank=True, on_delete=models.SET_NULL, related_name="bill")
    tariff_plan = models.ForeignKey("tariffs.TariffPlan", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    tariff_name = models.CharField(max_length=100, blank=True)
    previous_reading = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    current_reading = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    consumption = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    water_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    service_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    maintenance_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    infrastructure_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    penalty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    adjustment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    previous_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    issued_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField()
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ISSUED)
    lines = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-issued_at", "-id"]
        unique_together = [("customer", "period")]
        indexes = [models.Index(fields=["community", "status"]), models.Index(fields=["customer", "status"])]

    def __str__(self):
        return self.invoice_number

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            from core.ids import invoice_number
            self.invoice_number = invoice_number()
        super().save(*args, **kwargs)

    def recompute_status(self):
        from django.utils import timezone
        if self.status in (self.Status.CANCELLED, self.Status.CARRIED_FORWARD):
            return
        if self.outstanding_amount <= 0:
            self.status = self.Status.PAID
        elif self.amount_paid > 0:
            self.status = self.Status.PARTIALLY_PAID
        elif self.due_date < timezone.localdate():
            self.status = self.Status.OVERDUE
        else:
            self.status = self.Status.ISSUED
        if self.status == self.Status.PARTIALLY_PAID and self.due_date < timezone.localdate():
            self.status = self.Status.OVERDUE


class BillAdjustment(TenantModel):
    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name="adjustments")
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Negative reduces the bill, positive increases it")
    reason = models.TextField()
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    approval = models.ForeignKey("approvals.ApprovalRequest", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created_at"]


class DunningAction(TenantModel):
    class Stage(models.TextChoices):
        REMINDER = "REMINDER", "Reminder"
        SECOND_REMINDER = "SECOND_REMINDER", "Second reminder"
        FINAL_NOTICE = "FINAL_NOTICE", "Final notice"
        DISCONNECTION_WARNING = "DISCONNECTION_WARNING", "Disconnection warning"
        DISCONNECTION = "DISCONNECTION", "Disconnection"

    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE, related_name="dunning_actions")
    stage = models.CharField(max_length=25, choices=Stage.choices)
    outstanding = models.DecimalField(max_digits=12, decimal_places=2)
    days_overdue = models.PositiveIntegerField()
    approval = models.ForeignKey("approvals.ApprovalRequest", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created_at"]
