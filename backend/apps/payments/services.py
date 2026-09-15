"""
Payments: Payment → allocation (FIFO across outstanding bills) → Ledger → Receipt → Notification.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.utils import money
from apps.audit.services import log_action
from apps.billing.models import Bill
from .models import LedgerEntry, Payment, Receipt, Refund


def post_ledger(*, customer, entry_type, debit=Decimal("0"), credit=Decimal("0"), reference="", description="", bill=None, payment=None):
    """Appends a ledger entry and moves the customer's outstanding balance atomically."""
    from apps.customers.models import Customer
    with transaction.atomic():
        c = Customer.objects.select_for_update().get(pk=customer.pk)
        c.outstanding_balance = money(c.outstanding_balance + money(debit) - money(credit))
        c.save(update_fields=["outstanding_balance"])
        entry = LedgerEntry.objects.create(community=c.community, customer=c, entry_type=entry_type, debit=money(debit), credit=money(credit),
                                           balance_after=c.outstanding_balance, reference=reference, description=description, bill=bill, payment=payment)
        customer.outstanding_balance = c.outstanding_balance
        return entry


def _allocate(payment: Payment):
    remaining = money(payment.amount)
    allocations = []
    bills = list(Bill.objects.select_for_update().filter(customer=payment.customer, outstanding_amount__gt=0)
                 .exclude(status=Bill.Status.CANCELLED).order_by("due_date", "id"))
    if payment.bill_id:
        bills.sort(key=lambda b: 0 if b.id == payment.bill_id else 1)
    for b in bills:
        if remaining <= 0:
            break
        take = min(remaining, b.outstanding_amount)
        b.amount_paid = money(b.amount_paid + take)
        b.outstanding_amount = money(b.outstanding_amount - take)
        b.recompute_status()
        b.save(update_fields=["amount_paid", "outstanding_amount", "status", "updated_at"])
        allocations.append({"invoice": b.invoice_number, "bill_id": b.id, "amount": str(take)})
        remaining -= take
    if remaining > 0:
        allocations.append({"invoice": None, "amount": str(remaining), "note": "Credit carried forward"})
    return allocations


@transaction.atomic
def record_payment(*, community, customer, amount, method, recorded_by=None, bill=None, provider="", provider_reference="",
                   payer_phone="", payer_name="", paid_at=None, notes="", status=Payment.Status.SUCCESSFUL, deliver=None):
    amount = money(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be greater than zero."})
    if customer.community_id != community.id:
        raise ValidationError({"customer": "Customer belongs to another community."})
    if provider_reference and Payment.objects.filter(provider_reference=provider_reference, status=Payment.Status.SUCCESSFUL).exists():
        raise ValidationError({"provider_reference": "A successful payment with this provider reference already exists."})
    payment = Payment.objects.create(community=community, customer=customer, bill=bill, amount=amount, method=method, status=status,
                                     provider=provider or "", provider_reference=provider_reference or "", payer_phone=payer_phone or customer.phone,
                                     payer_name=payer_name or customer.contact_person, paid_at=paid_at or timezone.now(), recorded_by=recorded_by, notes=notes or "")
    if status == Payment.Status.SUCCESSFUL:
        settle_payment(payment, deliver=deliver)
    log_action("PAYMENT_RECORDED", payment, model_name="Payment", actor=recorded_by, changes={"amount": str(amount), "method": method, "status": status})
    return payment


@transaction.atomic
def settle_payment(payment: Payment, deliver=None):
    """Applies a successful payment: allocation → ledger → receipt → notification."""
    if Receipt.objects.filter(payment=payment).exists():
        return payment
    payment.allocations = _allocate(payment)
    payment.status = Payment.Status.SUCCESSFUL
    payment.save(update_fields=["allocations", "status", "updated_at"])
    post_ledger(customer=payment.customer, entry_type="PAYMENT", credit=payment.amount, reference=payment.reference,
                description=f"Payment via {payment.get_method_display()}", payment=payment, bill=payment.bill)
    c = payment.customer
    c.refresh_from_db()
    settings_obj = getattr(payment.community, "settings", None)
    channels = deliver if deliver is not None else [ch for ch, on in (("SMS", settings_obj.notify_sms if settings_obj else True),
                                                                        ("WHATSAPP", settings_obj.notify_whatsapp if settings_obj else False),
                                                                        ("EMAIL", settings_obj.notify_email if settings_obj else True)) if on] + ["PORTAL"]
    receipt = Receipt.objects.create(community=payment.community, payment=payment, customer=c, delivered_via=channels, snapshot={
        "receipt_number": None, "payment_reference": payment.reference, "customer": c.household_name, "customer_id": c.customer_id,
        "community": payment.community.name, "amount": str(payment.amount), "method": payment.get_method_display(),
        "paid_at": payment.paid_at.isoformat(), "allocations": payment.allocations, "balance_after": str(c.outstanding_balance),
    })
    receipt.snapshot["receipt_number"] = receipt.receipt_number
    receipt.save(update_fields=["snapshot"])
    from apps.notifications.services import notify
    notify("PAYMENT_RECEIVED", community=payment.community, customer=c, context={"amount": str(payment.amount), "receipt": receipt.receipt_number, "balance": str(c.outstanding_balance)})
    return payment


@transaction.atomic
def reverse_payment(payment: Payment, user, reason):
    if payment.status != Payment.Status.SUCCESSFUL:
        raise ValidationError("Only successful payments can be reversed.")
    for a in payment.allocations or []:
        if a.get("bill_id"):
            b = Bill.objects.select_for_update().get(pk=a["bill_id"])
            amt = money(a["amount"])
            b.amount_paid = money(b.amount_paid - amt)
            b.outstanding_amount = money(b.outstanding_amount + amt)
            b.recompute_status()
            b.save(update_fields=["amount_paid", "outstanding_amount", "status", "updated_at"])
    payment.status = Payment.Status.REVERSED
    payment.notes = (payment.notes + f"\nReversed by {user.full_name}: {reason}").strip()
    payment.save(update_fields=["status", "notes", "updated_at"])
    post_ledger(customer=payment.customer, entry_type="REVERSAL", debit=payment.amount, reference=payment.reference,
                description=f"Reversal of {payment.reference}: {reason}", payment=payment)
    log_action("PAYMENT_REVERSED", payment, model_name="Payment", actor=user, reason=reason)
    return payment


@transaction.atomic
def refund_payment(payment: Payment, amount, reason, user, approval=None):
    amount = money(amount)
    if payment.status != Payment.Status.SUCCESSFUL:
        raise ValidationError("Only successful payments can be refunded.")
    already = sum((r.amount for r in payment.refunds.all()), Decimal("0"))
    if amount <= 0 or already + amount > payment.amount:
        raise ValidationError({"amount": f"Refund must be between 0.01 and {payment.amount - already}."})
    r = Refund.objects.create(community=payment.community, payment=payment, customer=payment.customer, amount=amount, reason=reason, approved_by=user, approval=approval)
    if already + amount == payment.amount:
        payment.status = Payment.Status.REFUNDED
        payment.save(update_fields=["status"])
    post_ledger(customer=payment.customer, entry_type="REFUND", debit=amount, reference=payment.reference, description=f"Refund: {reason}", payment=payment)
    log_action("REFUND", r, model_name="Refund", actor=user, reason=reason, changes={"amount": str(amount)})
    return r


@transaction.atomic
def write_off_debt(customer, amount, reason, user, approval=None):
    amount = money(amount)
    if amount <= 0 or amount > customer.outstanding_balance:
        raise ValidationError({"amount": "Write-off must be positive and not exceed the outstanding balance."})
    remaining = amount
    for b in Bill.objects.select_for_update().filter(customer=customer, outstanding_amount__gt=0).exclude(status="CANCELLED").order_by("due_date"):
        if remaining <= 0:
            break
        take = min(remaining, b.outstanding_amount)
        b.outstanding_amount = money(b.outstanding_amount - take)
        b.adjustment = money(b.adjustment - take)
        b.total_amount = money(b.total_amount - take)
        b.lines = (b.lines or []) + [{"description": f"Debt write-off: {reason}", "quantity": "1", "rate": str(-take), "amount": str(-take), "type": "WRITE_OFF"}]
        b.recompute_status()
        b.save()
        remaining -= take
    post_ledger(customer=customer, entry_type="WRITE_OFF", credit=amount, description=f"Debt write-off: {reason}")
    log_action("DEBT_WRITE_OFF", customer, model_name="Customer", actor=user, reason=reason, changes={"amount": str(amount)})
