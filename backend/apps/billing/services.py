"""
Billing engine: Reading → Consumption → Tariff → Bill (→ Ledger → Notification), plus dunning / debt management.
"""
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.utils import money
from apps.audit.services import log_action
from apps.customers.models import Customer
from apps.meters.models import MeterReading
from apps.tariffs.engine import compute_water_charge, fixed_charges_for, resolve_plan
from .models import Bill, BillingPeriod, DunningAction


def _fixed_charge_buckets(community, category):
    buckets = {"SERVICE": Decimal("0"), "MAINTENANCE_LEVY": Decimal("0"), "INFRASTRUCTURE_LEVY": Decimal("0"), "OTHER": Decimal("0")}
    lines = []
    for sc in fixed_charges_for(community, category):
        buckets[sc.charge_type] += sc.amount
        lines.append({"description": sc.name, "quantity": "1", "rate": str(sc.amount), "amount": str(money(sc.amount)), "type": sc.charge_type})
    return buckets, lines


@transaction.atomic
def generate_bill_for_customer(customer: Customer, period: BillingPeriod, user=None, reading: MeterReading | None = None):
    community = period.community
    if customer.community_id != community.id:
        raise ValidationError("Customer belongs to another community.")
    if Bill.objects.filter(customer=customer, period=period).exists():
        return None, "already_billed"
    meter = customer.active_meter
    if reading is None:
        reading = (MeterReading.objects.filter(customer=customer, status=MeterReading.Status.VALIDATED,
                                               reading_date__lte=period.end_date).order_by("-reading_date", "-id").first())
    if reading is None:
        return None, "no_validated_reading"
    plan = resolve_plan(customer)
    if plan is None:
        return None, "no_tariff"
    consumption = max(reading.consumption, Decimal("0"))
    water_charge, lines = compute_water_charge(plan, consumption)
    buckets, fixed_lines = _fixed_charge_buckets(community, customer.category)
    settings_obj = getattr(community, "settings", None)
    penalty = Decimal("0")
    if settings_obj and settings_obj.late_penalty_percent and customer.outstanding_balance > 0:
        overdue = Bill.objects.filter(customer=customer, status=Bill.Status.OVERDUE).exists()
        if overdue:
            penalty = money(customer.outstanding_balance * settings_obj.late_penalty_percent / 100)
            lines.append({"description": f"Late payment penalty ({settings_obj.late_penalty_percent}% of arrears)", "quantity": "1", "rate": str(penalty), "amount": str(penalty), "type": "PENALTY"})
    current = money(water_charge + sum(buckets.values()) + penalty)
    previous_balance = money(customer.outstanding_balance)
    total = money(current + previous_balance)
    bill = Bill.objects.create(
        community=community, customer=customer, meter=meter or reading.meter, period=period, reading=reading, tariff_plan=plan,
        tariff_name=plan.name, previous_reading=reading.previous_reading, current_reading=reading.reading_value, consumption=consumption,
        water_charge=water_charge, service_charge=buckets["SERVICE"], maintenance_levy=buckets["MAINTENANCE_LEVY"],
        infrastructure_levy=buckets["INFRASTRUCTURE_LEVY"], other_charges=buckets["OTHER"], penalty=penalty,
        previous_balance=previous_balance, current_charges=current, total_amount=total, outstanding_amount=total,
        issued_at=timezone.now(), due_date=period.due_date, status=Bill.Status.ISSUED, lines=lines + fixed_lines,
    )
    reading.status = MeterReading.Status.BILLED
    reading.save(update_fields=["status"])
    # The new bill now carries the whole balance (previous_balance + current). Older unpaid bills are
    # rolled into it so that the sum of open bills always equals the customer's ledger balance and a
    # payment is allocated to one document — the latest bill — instead of being split across history.
    if previous_balance > 0:
        for old in Bill.objects.filter(customer=customer, outstanding_amount__gt=0).exclude(pk=bill.pk).exclude(status=Bill.Status.CANCELLED):
            old.notes = (old.notes + f"\nBalance of {old.outstanding_amount} carried forward into {bill.invoice_number}").strip()
            old.outstanding_amount = money(0)
            old.status = Bill.Status.CARRIED_FORWARD
            old.save(update_fields=["outstanding_amount", "status", "notes", "updated_at"])
    from apps.payments.services import post_ledger
    post_ledger(customer=customer, entry_type="BILL", debit=current, credit=Decimal("0"), reference=bill.invoice_number,
                description=f"Bill {bill.invoice_number} – {period.name}", bill=bill)
    from apps.notifications.services import notify
    notify("NEW_BILL", community=community, customer=customer, context={"invoice": bill.invoice_number, "amount": str(total), "due": str(period.due_date)})
    log_action("BILL_GENERATED", bill, model_name="Bill", actor=user, changes={"total": str(total), "consumption": str(consumption)})
    return bill, "created"


def generate_bills_for_period(period: BillingPeriod, user=None):
    if period.status == BillingPeriod.Status.CLOSED:
        raise ValidationError("This period is closed.")
    summary = {"created": 0, "already_billed": 0, "no_validated_reading": 0, "no_tariff": 0, "total": Decimal("0"), "skipped": []}
    customers = Customer.objects.filter(community=period.community, account_status__in=[Customer.Status.ACTIVE, Customer.Status.SUSPENDED])
    for c in customers.iterator():
        bill, outcome = generate_bill_for_customer(c, period, user)
        summary[outcome] += 1
        if bill:
            summary["total"] += bill.total_amount
        elif outcome != "already_billed":
            summary["skipped"].append({"customer": c.customer_id, "household": c.household_name, "reason": outcome})
    period.status = BillingPeriod.Status.GENERATED
    period.generated_at = timezone.now()
    period.generated_by = user
    period.bills_count = period.bills.count()
    period.total_billed = sum((b.total_amount for b in period.bills.all()), Decimal("0"))
    period.save()
    summary["total"] = str(money(summary["total"]))
    log_action("BILL_RUN", period, model_name="BillingPeriod", actor=user, changes={k: v for k, v in summary.items() if k != "skipped"})
    return summary


@transaction.atomic
def apply_adjustment(bill: Bill, amount, reason, user, approval=None):
    from .models import BillAdjustment
    from apps.payments.services import post_ledger
    amount = money(amount)
    if bill.status == Bill.Status.CANCELLED:
        raise ValidationError("Cancelled bills cannot be adjusted.")
    adj = BillAdjustment.objects.create(community=bill.community, bill=bill, amount=amount, reason=reason, approved_by=user, approval=approval)
    bill.adjustment += amount
    bill.total_amount = money(bill.total_amount + amount)
    bill.outstanding_amount = money(bill.total_amount - bill.amount_paid)
    bill.lines = (bill.lines or []) + [{"description": f"Adjustment: {reason}", "quantity": "1", "rate": str(amount), "amount": str(amount), "type": "ADJUSTMENT"}]
    bill.recompute_status()
    bill.save()
    post_ledger(customer=bill.customer, entry_type="ADJUSTMENT", debit=amount if amount > 0 else Decimal("0"),
                credit=-amount if amount < 0 else Decimal("0"), reference=bill.invoice_number, description=f"Adjustment on {bill.invoice_number}: {reason}", bill=bill)
    log_action("BILL_ADJUSTED", bill, model_name="Bill", actor=user, reason=reason, changes={"amount": str(amount)})
    return adj


def refresh_overdue(community=None):
    today = timezone.localdate()
    qs = Bill.objects.filter(status__in=[Bill.Status.ISSUED, Bill.Status.PARTIALLY_PAID], due_date__lt=today)
    if community:
        qs = qs.filter(community=community)
    n = qs.update(status=Bill.Status.OVERDUE)
    return n


def run_dunning(community, user=None):
    """Walks overdue customers through Reminder → Second → Final → Disconnection warning → Disconnection (approval-gated)."""
    from apps.approvals.models import ApprovalRequest
    from apps.notifications.services import notify
    refresh_overdue(community)
    settings_obj = getattr(community, "settings", None)
    reminder_days = sorted(settings_obj.reminder_days or [7, 14, 21]) if settings_obj else [7, 14, 21]
    disc_days = settings_obj.disconnection_after_days if settings_obj else 45
    today = timezone.localdate()
    actions = []
    stages = [DunningAction.Stage.REMINDER, DunningAction.Stage.SECOND_REMINDER, DunningAction.Stage.FINAL_NOTICE]
    for c in Customer.objects.filter(community=community, outstanding_balance__gt=0, account_status__in=["ACTIVE", "SUSPENDED"]):
        oldest = Bill.objects.filter(customer=c, status=Bill.Status.OVERDUE).order_by("due_date").first()
        if not oldest:
            continue
        days = (today - oldest.due_date).days
        done = set(DunningAction.objects.filter(customer=c, created_at__gte=timezone.now() - timedelta(days=120)).values_list("stage", flat=True))
        stage = None
        for i, d in enumerate(reminder_days[:3]):
            if days >= d and stages[i] not in done:
                stage = stages[i]
        if days >= max(disc_days - 7, reminder_days[-1] + 1) and DunningAction.Stage.DISCONNECTION_WARNING not in done:
            stage = DunningAction.Stage.DISCONNECTION_WARNING
        if days >= disc_days and DunningAction.Stage.DISCONNECTION not in done:
            stage = DunningAction.Stage.DISCONNECTION
        if not stage:
            continue
        approval = None
        if stage == DunningAction.Stage.DISCONNECTION:
            if settings_obj is None or settings_obj.disconnection_requires_approval:
                approval = ApprovalRequest.objects.create(community=community, request_type="DISCONNECTION", requested_by=user,
                                                          target_model="Customer", target_id=str(c.id), target_label=str(c),
                                                          payload={"customer": c.id, "outstanding": str(c.outstanding_balance), "days_overdue": days},
                                                          reason=f"Automatic: {days} days overdue, GHS {c.outstanding_balance} outstanding")
            else:
                c.account_status = Customer.Status.DISCONNECTED
                c.save(update_fields=["account_status"])
        DunningAction.objects.create(community=community, customer=c, stage=stage, outstanding=c.outstanding_balance, days_overdue=days, approval=approval)
        notify({"REMINDER": "BILL_OVERDUE", "SECOND_REMINDER": "BILL_OVERDUE", "FINAL_NOTICE": "FINAL_NOTICE",
                "DISCONNECTION_WARNING": "DISCONNECTION_WARNING", "DISCONNECTION": "DISCONNECTION_WARNING"}[stage],
               community=community, customer=c, context={"outstanding": str(c.outstanding_balance), "days": days, "stage": stage})
        actions.append({"customer": c.customer_id, "household": c.household_name, "stage": stage, "days_overdue": days, "outstanding": str(c.outstanding_balance)})
    log_action("DUNNING_RUN", model_name="DunningAction", community=community, actor=user, changes={"actions": len(actions)})
    return actions
