"""Executes an approved request. Each request type maps to the underlying business service, so approval == execution."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.audit.services import log_action
from apps.notifications.services import notify
from .models import ApprovalRequest


def _customer(req):
    from apps.customers.models import Customer
    return Customer.objects.get(pk=req.payload.get("customer") or req.target_id, community=req.community)


def execute(req: ApprovalRequest, user):
    p = req.payload or {}
    t = req.request_type
    if t == ApprovalRequest.Type.BILL_ADJUSTMENT:
        from apps.billing.models import Bill
        from apps.billing.services import apply_adjustment
        bill = Bill.objects.get(pk=p["bill"], community=req.community)
        apply_adjustment(bill, p["amount"], req.reason, user, approval=req)
        return {"bill": bill.invoice_number, "amount": p["amount"]}
    if t == ApprovalRequest.Type.REFUND:
        from apps.payments.models import Payment
        from apps.payments.services import refund_payment
        pay = Payment.objects.get(pk=p["payment"], community=req.community)
        r = refund_payment(pay, p["amount"], req.reason, user, approval=req)
        return {"refund": r.id, "amount": str(r.amount)}
    if t == ApprovalRequest.Type.TARIFF_CHANGE:
        from apps.tariffs.models import TariffPlan
        c = _customer(req)
        plan = TariffPlan.objects.get(pk=p["tariff_plan"])
        old = c.tariff_plan.name if c.tariff_plan else None
        c.tariff_plan = plan
        if p.get("category"):
            c.category = p["category"]
        c.save()
        log_action("TARIFF_CHANGED", c, model_name="Customer", actor=user, reason=req.reason, changes={"tariff": {"from": old, "to": plan.name}})
        return {"customer": c.customer_id, "tariff": plan.name}
    if t == ApprovalRequest.Type.METER_REPLACEMENT:
        from apps.meters.models import Meter
        from apps.meters.services import replace_meter
        old = Meter.objects.get(pk=p["old_meter"], community=req.community)
        new = Meter.objects.get(pk=p["new_meter"], community=req.community)
        rep = replace_meter(community=req.community, old_meter=old, new_meter=new, final_reading=p["final_reading"], initial_reading=p["initial_reading"], reason=req.reason, performed_by=user)
        return {"replacement": rep.id}
    if t in (ApprovalRequest.Type.CUSTOMER_DEACTIVATION, ApprovalRequest.Type.DISCONNECTION, ApprovalRequest.Type.RECONNECTION):
        c = _customer(req)
        old = c.account_status
        c.account_status = {"CUSTOMER_DEACTIVATION": "INACTIVE", "DISCONNECTION": "DISCONNECTED", "RECONNECTION": "ACTIVE"}[t]
        c.save(update_fields=["account_status"])
        log_action(t, c, model_name="Customer", actor=user, reason=req.reason, changes={"account_status": {"from": old, "to": c.account_status}})
        if t == "DISCONNECTION":
            notify("DISCONNECTION_WARNING", community=req.community, customer=c, context={"outstanding": str(c.outstanding_balance)})
        return {"customer": c.customer_id, "status": c.account_status}
    if t == ApprovalRequest.Type.DEBT_WRITE_OFF:
        from apps.payments.services import write_off_debt
        c = _customer(req)
        write_off_debt(c, p["amount"], req.reason, user, approval=req)
        return {"customer": c.customer_id, "written_off": p["amount"]}
    if t == ApprovalRequest.Type.PAYMENT_CORRECTION:
        from apps.payments.models import Payment
        from apps.payments.services import reverse_payment
        pay = Payment.objects.get(pk=p["payment"], community=req.community)
        reverse_payment(pay, user, req.reason)
        return {"payment": pay.reference, "status": pay.status}
    raise ValidationError(f"No executor for {t}.")


REQUIRED = {
    "BILL_ADJUSTMENT": ["bill", "amount"], "REFUND": ["payment", "amount"], "TARIFF_CHANGE": ["customer", "tariff_plan"],
    "METER_REPLACEMENT": ["old_meter", "new_meter", "final_reading", "initial_reading"], "CUSTOMER_DEACTIVATION": ["customer"],
    "DEBT_WRITE_OFF": ["customer", "amount"], "DISCONNECTION": ["customer"], "RECONNECTION": ["customer"], "PAYMENT_CORRECTION": ["payment"],
}


def validate_payload(request_type, payload):
    missing = [k for k in REQUIRED.get(request_type, []) if payload.get(k) in (None, "")]
    if missing:
        raise ValidationError({"payload": f"Missing: {', '.join(missing)}"})


@transaction.atomic
def decide(req: ApprovalRequest, user, approve: bool, note: str = ""):
    if req.status != ApprovalRequest.Status.PENDING:
        raise ValidationError("This request has already been decided.")
    if req.requested_by_id == user.id:
        raise ValidationError("You cannot approve your own request.")
    req.reviewed_by, req.reviewed_at, req.review_note = user, timezone.now(), note
    if not approve:
        req.status = ApprovalRequest.Status.REJECTED
        req.save()
        log_action("APPROVAL_REJECTED", req, model_name="ApprovalRequest", actor=user, reason=note)
    else:
        req.status = ApprovalRequest.Status.APPROVED
        req.save()
        try:
            with transaction.atomic():
                req.execution_result = execute(req, user)
                req.status = ApprovalRequest.Status.EXECUTED
        except Exception as e:
            req.status = ApprovalRequest.Status.FAILED
            req.execution_result = {"error": str(e)[:300]}
        req.save()
        log_action("APPROVAL_APPROVED", req, model_name="ApprovalRequest", actor=user, reason=note, changes=req.execution_result)
    if req.requested_by:
        notify("APPROVAL_DECIDED", community=req.community, user=req.requested_by,
               context={"type": req.get_request_type_display(), "label": req.target_label, "decision": req.status.lower(), "note": note})
    return req
