"""
Central notification engine. Every event is rendered from a template and fanned out to the
channels the community has enabled. Delivery backends are pluggable (console by default;
Arkesel/Hubtel SMS when API keys are configured). In-app (PORTAL) is always stored.
"""
import logging
from django.conf import settings
from django.utils import timezone
from .models import Notification

log = logging.getLogger(__name__)

TEMPLATES = {
    "NEW_BILL": ("New water bill", "Hello {name}, your water bill {invoice} of GHS {amount} is ready. Due {due}. Pay via MoMo or the portal. – {community}"),
    "PAYMENT_RECEIVED": ("Payment received", "Thank you {name}. We received GHS {amount}. Receipt {receipt}. Balance: GHS {balance}. – {community}"),
    "PAYMENT_FAILED": ("Payment failed", "Hello {name}, your payment of GHS {amount} could not be processed. Please try again. – {community}"),
    "BILL_OVERDUE": ("Bill overdue", "Hello {name}, your water account has GHS {outstanding} overdue by {days} days. Please pay to avoid penalties. – {community}"),
    "FINAL_NOTICE": ("Final notice", "FINAL NOTICE: {name}, GHS {outstanding} is {days} days overdue. Settle within 7 days to avoid disconnection. – {community}"),
    "DISCONNECTION_WARNING": ("Disconnection warning", "{name}, your water supply is scheduled for disconnection due to GHS {outstanding} unpaid. Pay now to keep your supply. – {community}"),
    "WATER_OUTAGE": ("Water outage", "Water outage in {area}: {cause}. Expected restoration: {expected}. Sorry for the inconvenience. – {community}"),
    "WATER_RESTORED": ("Water restored", "Water supply has been restored in {area}. Thank you for your patience. – {community}"),
    "LEAK_DETECTED": ("Possible leak", "Hello {name}, your consumption ({consumption} m³) is unusually high. Please check for leaks. – {community}"),
    "METER_REPLACED": ("Meter replaced", "Hello {name}, your meter {old} was replaced with {new}. – {community}"),
    "METER_INSPECTION": ("Meter inspection", "Hello {name}, a meter inspection is scheduled at your property on {date}. – {community}"),
    "MAINTENANCE_DUE": ("Maintenance due", "{asset} maintenance is due in {days} days ({date}). – {community}"),
    "SERVICE_REQUEST_UPDATE": ("Service request update", "Hello {name}, ticket {ticket} is now {status}. {note} – {community}"),
    "WATER_QUALITY_ALERT": ("Water quality alert", "Water quality alert at {location}: {issues}. Investigation required. – {community}"),
    "EMERGENCY": ("Emergency", "{severity} emergency declared: {type} – {title}. Follow community instructions. – {community}"),
    "APPROVAL_REQUESTED": ("Approval needed", "{requester} requested approval: {type} – {label}. – {community}"),
    "APPROVAL_DECIDED": ("Request {decision}", "Your request '{type} – {label}' was {decision}. {note} – {community}"),
    "PUBLIC_REPORT": ("Public report", "New public report {ticket}: {category} at {town} — {location}. Please triage. – {community}"),
    "TICKET_ASSIGNED": ("Ticket assigned", "Ticket {ticket} ({category}) has been assigned to you. Priority: {priority}. – {community}"),
}


def _render(event, ctx):
    title, body = TEMPLATES.get(event, (event.replace("_", " ").title(), "{message}"))
    safe = {k: (v if v is not None else "") for k, v in ctx.items()}
    try:
        return title.format(**safe), body.format(**safe)
    except KeyError as e:
        return title, body.replace("{" + str(e).strip("'") + "}", "")


def _deliver(n: Notification):
    try:
        if n.channel == Notification.Channel.PORTAL:
            n.status = Notification.Status.SENT
        elif n.channel == Notification.Channel.SMS and settings.SMS_PROVIDER != "console" and settings.SMS_API_KEY:
            _send_sms(n.recipient, n.message)
            n.status = Notification.Status.SENT
        elif n.channel == Notification.Channel.EMAIL and getattr(settings, "EMAIL_HOST", None):
            from django.core.mail import send_mail
            send_mail(n.title, n.message, getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@wtr.gh"), [n.recipient], fail_silently=False)
            n.status = Notification.Status.SENT
        else:
            log.info("[%s → %s] %s: %s", n.channel, n.recipient, n.title, n.message)
            n.status = Notification.Status.SENT   # console backend
        n.sent_at = timezone.now()
    except Exception as e:  # pragma: no cover
        n.status = Notification.Status.FAILED
        n.error = str(e)[:300]
    n.save(update_fields=["status", "sent_at", "error"])


def _send_sms(phone, message):
    import json, urllib.request
    if settings.SMS_PROVIDER == "arkesel":
        req = urllib.request.Request("https://sms.arkesel.com/api/v2/sms/send", data=json.dumps({"sender": settings.SMS_SENDER_ID, "message": message, "recipients": [phone]}).encode(),
                                     headers={"api-key": settings.SMS_API_KEY, "Content-Type": "application/json"})
    elif settings.SMS_PROVIDER == "hubtel":
        req = urllib.request.Request("https://smsc.hubtel.com/v1/messages/send", data=json.dumps({"From": settings.SMS_SENDER_ID, "To": phone, "Content": message}).encode(),
                                     headers={"Authorization": f"Basic {settings.SMS_API_KEY}", "Content-Type": "application/json"})
    else:
        return
    urllib.request.urlopen(req, timeout=10).read()


def notify(event, *, community, customer=None, user=None, context=None, channels=None):
    ctx = dict(context or {})
    ctx.setdefault("community", community.name)
    s = getattr(community, "settings", None)
    if customer:
        ctx.setdefault("name", customer.contact_person or customer.household_name)
        if channels is None:
            channels = ["PORTAL"] + [c for c, on in (("SMS", s.notify_sms if s else True), ("WHATSAPP", s.notify_whatsapp if s else False),
                                                    ("EMAIL", (s.notify_email if s else True) and bool(customer.email))) if on]
    elif user:
        ctx.setdefault("name", user.full_name)
        channels = channels or ["PORTAL"]
    else:
        return []
    title, message = _render(event, ctx)
    out = []
    for ch in channels:
        recipient = (customer.phone if customer else user.phone) if ch in ("SMS", "WHATSAPP") else (customer.email if customer else user.email) if ch == "EMAIL" else (customer.customer_id if customer else user.email)
        if ch in ("SMS", "WHATSAPP", "EMAIL") and not recipient:
            continue
        n = Notification.objects.create(community=community, event=event, channel=ch, customer=customer, user=user if not customer else (customer.user if customer else None),
                                        recipient=recipient or "", title=title, message=message, metadata=ctx)
        _deliver(n)
        out.append(n)
    return out


def notify_community(event, community, context=None, staff_only=False):
    """Broadcast to every active customer of a community (or just staff)."""
    from apps.accounts.models import User
    from apps.customers.models import Customer
    from core.roles import Role
    count = 0
    if not staff_only:
        for c in Customer.objects.filter(community=community, account_status__in=["ACTIVE", "SUSPENDED"]).iterator():
            notify(event, community=community, customer=c, context=context)
            count += 1
    for u in User.objects.filter(community=community, is_active=True, role__in=Role.COMMUNITY_STAFF_ROLES):
        notify(event, community=community, user=u, context=context)
    return count
