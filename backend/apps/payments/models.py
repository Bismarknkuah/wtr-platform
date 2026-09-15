from django.conf import settings
from django.db import models
from core.models import TenantModel


class Payment(TenantModel):
    class Method(models.TextChoices):
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        BANK = "BANK", "Bank payment"
        ONLINE = "ONLINE", "Online (card / gateway)"
        CASH = "CASH", "Cash"
        MANUAL = "MANUAL", "Manual entry"
        AGENT = "AGENT", "Payment agent"
        USSD = "USSD", "USSD"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESSFUL = "SUCCESSFUL", "Successful"
        FAILED = "FAILED", "Failed"
        REVERSED = "REVERSED", "Reversed"
        REFUNDED = "REFUNDED", "Refunded"

    reference = models.CharField(max_length=40, unique=True, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="payments")
    bill = models.ForeignKey("billing.Bill", null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=15, choices=Method.choices, default=Method.CASH)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUCCESSFUL)
    provider = models.CharField(max_length=60, blank=True, help_text="MTN MoMo, Vodafone Cash, Paystack, GCB ...")
    provider_reference = models.CharField(max_length=120, blank=True)
    payer_phone = models.CharField(max_length=30, blank=True)
    payer_name = models.CharField(max_length=120, blank=True)
    paid_at = models.DateTimeField()
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments_recorded")
    allocations = models.JSONField(default=list, blank=True, help_text="[{invoice, amount}] how the payment was applied")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-paid_at", "-id"]
        indexes = [models.Index(fields=["community", "status"]), models.Index(fields=["customer", "paid_at"])]

    def __str__(self):
        return self.reference

    def save(self, *args, **kwargs):
        if not self.reference:
            from core.ids import payment_reference
            self.reference = payment_reference()
        super().save(*args, **kwargs)


class Receipt(TenantModel):
    receipt_number = models.CharField(max_length=40, unique=True, editable=False)
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name="receipt")
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="receipts")
    issued_at = models.DateTimeField(auto_now_add=True)
    delivered_via = models.JSONField(default=list, blank=True)
    snapshot = models.JSONField(default=dict, blank=True, help_text="Immutable copy of the receipt content at issue time")

    def __str__(self):
        return self.receipt_number

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            from core.ids import receipt_number
            self.receipt_number = receipt_number()
        super().save(*args, **kwargs)


class LedgerEntry(TenantModel):
    """Append-only customer ledger. Debits increase what the customer owes; credits reduce it."""
    class Type(models.TextChoices):
        BILL = "BILL", "Bill"
        PAYMENT = "PAYMENT", "Payment"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        REFUND = "REFUND", "Refund"
        REVERSAL = "REVERSAL", "Payment reversal"
        WRITE_OFF = "WRITE_OFF", "Debt write-off"
        OPENING = "OPENING", "Opening balance"

    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="ledger")
    entry_type = models.CharField(max_length=12, choices=Type.choices)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=40, blank=True)
    description = models.CharField(max_length=255, blank=True)
    bill = models.ForeignKey("billing.Bill", null=True, blank=True, on_delete=models.SET_NULL, related_name="ledger_entries")
    payment = models.ForeignKey(Payment, null=True, blank=True, on_delete=models.SET_NULL, related_name="ledger_entries")

    class Meta:
        ordering = ["-created_at", "-id"]


class Refund(TenantModel):
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="refunds")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    approval = models.ForeignKey("approvals.ApprovalRequest", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created_at"]
