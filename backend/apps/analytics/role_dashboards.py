"""
Role-specific dashboard payloads.

Each function returns a JSON-serialisable dict tailored to what one role needs to see
first thing in the morning. They deliberately reuse the same aggregation helpers as the
community dashboard so every number on every screen reconciles.

    finance_dashboard(community)        Community Finance Officer / Platform Finance Admin
    operations_dashboard(community)     Community Water Manager / Platform Operations Admin
    meter_reader_dashboard(user)        Meter Reader (own routes only)
    technician_dashboard(user)          Technician (own tickets + community infrastructure)
    support_dashboard(community)        Customer Support
    auditor_dashboard(community)        Community Auditor (read-only, one community)
    activity_feed(community|None)       Recent audit events, humanised for the UI
"""
from collections import Counter, defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Max, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone

from apps.accounts.models import User
from apps.approvals.models import ApprovalRequest
from apps.audit.models import AuditLog
from apps.billing.models import Bill, BillAdjustment, BillingPeriod, DunningAction
from apps.customers.models import Customer
from apps.infrastructure.models import Asset, Emergency, MaintenanceRecord, Outage, WaterQualityTest
from apps.meters.models import Meter, MeterReading, MeterReplacement, ReadingRoute
from apps.notifications.models import Notification
from apps.payments.models import LedgerEntry, Payment, Refund
from apps.tickets.models import ServiceRequest

from .models import WaterProduction
from .services import _f, _month_bounds, _months_back, collection_efficiency, monthly_trend, sustainability_score, water_loss_percent


# --------------------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------------------

def _pct_change(current, previous):
    """Percentage change from previous to current; None when there is nothing to compare against."""
    if not previous:
        return None
    return round((float(current) - float(previous)) / float(previous) * 100, 1)


def _daily_series(qs, date_field, value_field, days, today=None, count_field=None):
    """Return a list of {date, total, count} for the last `days` days, zero-filled."""
    today = today or timezone.localdate()
    start = today - timedelta(days=days - 1)
    rows = qs.filter(**{f"{date_field}__date__gte": start}).annotate(d=TruncDate(date_field)).values("d")
    rows = (rows.annotate(total=Sum(value_field), count=Count("id")) if value_field else rows.annotate(count=Count("id"))).order_by("d")
    lookup = {r["d"].isoformat(): r for r in rows}
    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        r = lookup.get(d)
        row = {"date": d, "count": r["count"] if r else 0}
        if value_field:
            row["total"] = _f(r["total"]) if r else 0.0
        out.append(row)
    return out


def _hours_between(a, b):
    if not a or not b:
        return None
    return round((b - a).total_seconds() / 3600, 1)


def _customer_brief(c):
    return {
        "id": c.id, "customer_id": c.customer_id, "household": c.household_name, "phone": c.phone,
        "category": c.category, "status": c.account_status, "outstanding": _f(c.outstanding_balance),
        "risk_level": c.risk_level, "risk_score": c.risk_score,
    }


def _ticket_brief(t):
    now = timezone.now()
    return {
        "id": t.id, "ticket_number": t.ticket_number, "title": t.title, "category": t.category, "priority": t.priority,
        "status": t.status, "location": t.location, "customer": t.customer_id,
        "customer_name": t.customer.household_name if t.customer_id else None,
        "customer_phone": t.customer.phone if t.customer_id else None,
        "assigned_to": t.assigned_to_id, "assigned_to_name": t.assigned_to.full_name if t.assigned_to_id else None,
        "created_at": t.created_at, "age_hours": _hours_between(t.created_at, now),
        "resolved_at": t.resolved_at, "satisfaction_rating": t.satisfaction_rating,
    }


def _asset_brief(a, today=None):
    today = today or timezone.localdate()
    due_in = (a.next_maintenance - today).days if a.next_maintenance else None
    return {
        "id": a.id, "asset_id": a.asset_id, "name": a.name, "asset_type": a.asset_type, "status": a.status,
        "parent_name": a.parent.name if a.parent_id else None, "capacity": a.capacity,
        "last_maintenance": a.last_maintenance, "next_maintenance": a.next_maintenance, "maintenance_due_in_days": due_in,
        "latitude": a.latitude, "longitude": a.longitude,
    }


# --------------------------------------------------------------------------------------
# Finance
# --------------------------------------------------------------------------------------

def finance_dashboard(community):
    today = timezone.localdate()
    mstart, mend = _month_bounds()
    pstart = (mstart - timedelta(days=1)).replace(day=1)

    eff, billed_m, collected_m = collection_efficiency(community, mstart, mend)
    _, billed_p, collected_p = collection_efficiency(community, pstart, mstart)

    customers = Customer.objects.filter(community=community)
    bills = Bill.objects.filter(community=community).exclude(status="CANCELLED")
    payments = Payment.objects.filter(community=community, status="SUCCESSFUL")
    outstanding_total = _f(customers.aggregate(s=Sum("outstanding_balance"))["s"])
    credit_total = _f(customers.filter(outstanding_balance__lt=0).aggregate(s=Sum("outstanding_balance"))["s"])

    # Aging of unpaid bills by days past due
    open_bills = bills.filter(outstanding_amount__gt=0)
    buckets = {"current": 0.0, "1_30": 0.0, "31_60": 0.0, "61_90": 0.0, "over_90": 0.0}
    bucket_counts = {k: 0 for k in buckets}
    for b in open_bills.only("due_date", "outstanding_amount"):
        days = (today - b.due_date).days
        key = "current" if days <= 0 else "1_30" if days <= 30 else "31_60" if days <= 60 else "61_90" if days <= 90 else "over_90"
        buckets[key] += _f(b.outstanding_amount)
        bucket_counts[key] += 1

    # Debt ladder – how many customers sit at each dunning stage (latest action per customer)
    latest_stage = {}
    for d in DunningAction.objects.filter(community=community).order_by("customer_id", "-created_at").only("customer_id", "stage"):
        latest_stage.setdefault(d.customer_id, d.stage)
    ladder = Counter(latest_stage.values())

    # Bill status mix this month
    status_mix = list(bills.filter(issued_at__date__gte=mstart).values("status").annotate(count=Count("id"), amount=Sum("total_amount")).order_by("-count"))

    # Today's collections and channel split
    today_collected = _f(payments.filter(paid_at__date=today).aggregate(s=Sum("amount"))["s"])
    by_method = list(payments.filter(paid_at__date__gte=mstart).values("method").annotate(total=Sum("amount"), count=Count("id")).order_by("-total"))
    by_category = list(
        bills.filter(issued_at__date__gte=mstart).values("customer__category").annotate(billed=Sum("current_charges"), bills=Count("id")).order_by("-billed")
    )
    collectors = list(
        payments.filter(paid_at__date__gte=mstart, recorded_by__isnull=False)
        .values("recorded_by__full_name").annotate(total=Sum("amount"), count=Count("id")).order_by("-total")[:6]
    )

    # Financial-type approvals waiting on someone
    financial_types = ["BILL_ADJUSTMENT", "REFUND", "DEBT_WRITE_OFF", "PAYMENT_CORRECTION", "DISCONNECTION", "RECONNECTION"]
    pending_approvals = ApprovalRequest.objects.filter(community=community, status="PENDING", request_type__in=financial_types).select_related("requested_by")

    adjustments_m = _f(BillAdjustment.objects.filter(community=community, created_at__date__gte=mstart).aggregate(s=Sum("amount"))["s"])
    refunds_m = _f(Refund.objects.filter(community=community, created_at__date__gte=mstart).aggregate(s=Sum("amount"))["s"])
    reversals_m = Payment.objects.filter(community=community, status="REVERSED", updated_at__date__gte=mstart).count()
    write_offs_m = _f(LedgerEntry.objects.filter(community=community, entry_type="WRITE_OFF", created_at__date__gte=mstart).aggregate(s=Sum("credit"))["s"])

    periods = BillingPeriod.objects.filter(community=community).order_by("-start_date")[:4]
    top_debtors = customers.filter(outstanding_balance__gt=0).order_by("-outstanding_balance")[:8]

    # ---- analytics: efficiency by month, revenue by customer type by month, weekday pattern, method trend
    trend = monthly_trend(community, 6)
    for row in trend:
        row["efficiency"] = round(row["collected"] / row["billed"] * 100, 1) if row["billed"] else None
    six_start = _months_back(6)
    cat_rows = bills.filter(issued_at__date__gte=six_start).annotate(m=TruncMonth("issued_at")).values("m", "customer__category").annotate(s=Sum("current_charges")).order_by("m")
    by_month_cat = defaultdict(dict)
    for r in cat_rows:
        by_month_cat[r["m"].strftime("%b %Y")][r["customer__category"]] = _f(r["s"])
    category_trend = [{"month": t["month"], **by_month_cat.get(t["month"], {})} for t in trend]
    method_rows = payments.filter(paid_at__date__gte=six_start).annotate(m=TruncMonth("paid_at")).values("m", "method").annotate(s=Sum("amount")).order_by("m")
    by_month_method = defaultdict(dict)
    for r in method_rows:
        by_month_method[r["m"].strftime("%b %Y")][r["method"]] = _f(r["s"])
    method_trend = [{"month": t["month"], **by_month_method.get(t["month"], {})} for t in trend]
    weekday = [0.0] * 7
    for p in payments.filter(paid_at__date__gte=today - timedelta(days=90)).only("paid_at", "amount"):
        weekday[timezone.localtime(p.paid_at).weekday()] += _f(p.amount)
    weekday_pattern = [{"day": d, "total": round(v, 2)} for d, v in zip(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], weekday)]
    avg_bill = _f(bills.filter(issued_at__date__gte=mstart).aggregate(a=Avg("total_amount"))["a"])
    avg_days_to_pay = None
    paid_bills = bills.filter(status="PAID", issued_at__date__gte=six_start).only("issued_at", "updated_at")
    if paid_bills.exists():
        days = [(b.updated_at - b.issued_at).days for b in paid_bills]
        avg_days_to_pay = round(sum(days) / len(days), 1)
    recent_payments = payments.select_related("customer", "recorded_by").order_by("-paid_at")[:8]

    return {
        "period": {"month": mstart.strftime("%B %Y"), "start": mstart, "end": mend - timedelta(days=1), "days_elapsed": today.day, "days_in_month": (mend - mstart).days},
        "kpis": {
            "billed": billed_m, "billed_change": _pct_change(billed_m, billed_p),
            "collected": collected_m, "collected_change": _pct_change(collected_m, collected_p),
            "collection_efficiency": eff, "today_collected": today_collected,
            "outstanding": outstanding_total, "customer_credit": abs(credit_total),
            "debtors": customers.filter(outstanding_balance__gt=0).count(),
            "overdue_bills": bills.filter(status="OVERDUE").count(),
            "overdue_amount": _f(bills.filter(status="OVERDUE").aggregate(s=Sum("outstanding_amount"))["s"]),
            "pending_approvals": pending_approvals.count(),
            "adjustments_month": adjustments_m, "refunds_month": refunds_m, "reversals_month": reversals_m, "write_offs_month": write_offs_m,
        },
        "daily_collections": _daily_series(payments, "paid_at", "amount", 30, today),
        "trend": trend,
        "analytics": {
            "category_trend": category_trend, "method_trend": method_trend, "weekday_pattern": weekday_pattern,
            "avg_bill": avg_bill, "avg_days_to_pay": avg_days_to_pay,
            "categories": sorted({k for r in category_trend for k in r if k != "month"}),
            "methods": sorted({k for r in method_trend for k in r if k != "month"}),
        },
        "aging": {"buckets": buckets, "counts": bucket_counts, "total": round(sum(buckets.values()), 2)},
        "ladder": {stage: ladder.get(stage, 0) for stage in ["REMINDER", "SECOND_REMINDER", "FINAL_NOTICE", "DISCONNECTION_WARNING", "DISCONNECTION"]},
        "bill_status_mix": status_mix,
        "by_method": by_method,
        "by_category": by_category,
        "collectors": collectors,
        "periods": [
            {"id": p.id, "name": p.name, "status": p.status, "frequency": p.frequency, "start_date": p.start_date, "end_date": p.end_date,
             "due_date": p.due_date, "bills_count": p.bills_count, "total_billed": _f(p.total_billed), "generated_at": p.generated_at}
            for p in periods
        ],
        "top_debtors": [_customer_brief(c) for c in top_debtors],
        "recent_payments": [
            {"id": p.id, "reference": p.reference, "customer": p.customer_id, "customer_name": p.customer.household_name, "customer_code": p.customer.customer_id,
             "amount": _f(p.amount), "method": p.method, "provider": p.provider, "paid_at": p.paid_at,
             "recorded_by": p.recorded_by.full_name if p.recorded_by_id else "portal"}
            for p in recent_payments
        ],
        "pending_approvals": [
            {"id": a.id, "request_type": a.request_type, "target_label": a.target_label, "reason": a.reason, "payload": a.payload,
             "requested_by_name": a.requested_by.full_name if a.requested_by_id else None, "created_at": a.created_at}
            for a in pending_approvals.order_by("-created_at")[:8]
        ],
    }


# --------------------------------------------------------------------------------------
# Operations (water manager)
# --------------------------------------------------------------------------------------

def operations_dashboard(community):
    today = timezone.localdate()
    mstart, mend = _month_bounds()
    loss, produced, consumed = water_loss_percent(community, mstart, mend)

    meters = Meter.objects.filter(community=community)
    readings = MeterReading.objects.filter(community=community)
    customers_active = Customer.objects.filter(community=community, account_status="ACTIVE")

    # Reading coverage this month: customers with an active meter who have a reading dated within the month
    active_meter_customers = customers_active.filter(meters__status="ACTIVE").distinct()
    read_ids = set(readings.filter(reading_date__gte=mstart, reading_date__lt=mend).values_list("customer_id", flat=True))
    coverage_total = active_meter_customers.count()
    coverage_read = len([c for c in active_meter_customers.values_list("id", flat=True) if c in read_ids])

    # Anomaly flag histogram (pending only – the things that still need a decision)
    flag_counts = Counter()
    for flags in readings.filter(is_anomalous=True, status="PENDING").values_list("anomaly_flags", flat=True):
        flag_counts.update(flags or [])

    # Daily production vs consumption, last 30 days
    prod_rows = {r["date"].isoformat(): _f(r["s"]) for r in WaterProduction.objects.filter(community=community, date__gte=today - timedelta(days=29)).values("date").annotate(s=Sum("volume_m3"))}
    cons_rows = {r["reading_date"].isoformat(): _f(r["s"]) for r in readings.filter(reading_date__gte=today - timedelta(days=29), status__in=["VALIDATED", "BILLED"], consumption__gt=0).values("reading_date").annotate(s=Sum("consumption"))}
    daily = []
    for i in range(30):
        d = (today - timedelta(days=29 - i)).isoformat()
        daily.append({"date": d, "produced": prod_rows.get(d, 0.0), "consumed": cons_rows.get(d, 0.0)})

    # NRW by month (6 months)
    nrw_trend = []
    cur = (mstart - timedelta(days=31 * 5)).replace(day=1)
    for _ in range(6):
        nxt = (cur + timedelta(days=32)).replace(day=1)
        l, p, c = water_loss_percent(community, cur, nxt)
        nrw_trend.append({"month": cur.strftime("%b %Y"), "produced": p, "consumed": c, "loss_percent": l})
        cur = nxt

    # Routes and their progress this month
    routes = []
    for r in ReadingRoute.objects.filter(community=community, is_active=True).select_related("reader").prefetch_related("customers"):
        ids = list(r.customers.values_list("id", flat=True))
        done = len([i for i in ids if i in read_ids])
        routes.append({"id": r.id, "name": r.name, "reader_name": r.reader.full_name if r.reader_id else None, "households": len(ids), "read": done,
                       "progress": round(done / len(ids) * 100) if ids else 0, "schedule_note": r.schedule_note})

    assets = Asset.objects.filter(community=community).exclude(status="DECOMMISSIONED").select_related("parent")
    due_assets = assets.filter(next_maintenance__lte=today + timedelta(days=30)).order_by("next_maintenance")
    quality = WaterQualityTest.objects.filter(community=community).order_by("-tested_on")[:8]
    quality_history = list(
        WaterQualityTest.objects.filter(community=community, tested_on__gte=today - timedelta(days=180))
        .annotate(m=TruncMonth("tested_on")).values("m").annotate(tests=Count("id"), compliant=Count("id", filter=Q(compliance_status="COMPLIANT"))).order_by("m")
    )
    outages = Outage.objects.filter(community=community).select_related("asset").order_by("-started_at")[:6]
    outage_hours_90 = 0.0
    for o in Outage.objects.filter(community=community, started_at__gte=timezone.now() - timedelta(days=90)):
        outage_hours_90 += ((o.restored_at or timezone.now()) - o.started_at).total_seconds() / 3600

    top_consumers = readings.filter(reading_date__gte=mstart, status__in=["VALIDATED", "BILLED", "PENDING"]).values(
        "customer__id", "customer__household_name", "customer__customer_id", "customer__category").annotate(m3=Sum("consumption")).order_by("-m3")[:8]
    flagged = readings.filter(is_anomalous=True, status="PENDING").select_related("meter", "customer", "read_by").order_by("-reading_date")[:8]
    replacements = MeterReplacement.objects.filter(community=community, performed_on__gte=today - timedelta(days=90)).count()

    # ---- analytics: consumption by category this month, per-connection average, coverage trend, anomaly trend, 6-month consumption
    cons_by_cat = list(readings.filter(reading_date__gte=mstart, status__in=["VALIDATED", "BILLED"]).values("customer__category").annotate(m3=Sum("consumption"), n=Count("customer", distinct=True)).order_by("-m3"))
    cons_by_cat = [{"category": r["customer__category"], "m3": _f(r["m3"]), "connections": r["n"], "per_connection": round(_f(r["m3"]) / r["n"], 1) if r["n"] else 0} for r in cons_by_cat]
    coverage_trend, anomaly_trend = [], []
    cur = _months_back(6)
    for _ in range(6):
        nxt = (cur + timedelta(days=32)).replace(day=1)
        month_readings = readings.filter(reading_date__gte=cur, reading_date__lt=nxt)
        read_customers = month_readings.values("customer").distinct().count()
        coverage_trend.append({"month": cur.strftime("%b %Y"), "read": read_customers, "total": coverage_total, "percent": min(100, round(read_customers / coverage_total * 100)) if coverage_total else 0})
        anomaly_trend.append({"month": cur.strftime("%b %Y"), "readings": month_readings.count(), "flagged": month_readings.filter(is_anomalous=True).count(), "rejected": month_readings.filter(status="REJECTED").count()})
        cur = nxt
    avg_per_connection = round(consumed / coverage_read, 1) if coverage_read else None
    lpcd = None
    occupants = customers_active.aggregate(s=Sum("occupants"))["s"] or 0
    if occupants and consumed:
        lpcd = round(consumed * 1000 / occupants / max(1, today.day))       # litres per person per day, month to date

    return {
        "kpis": {
            "produced_m3": produced, "consumed_m3": consumed, "water_loss_percent": loss,
            "loss_target_percent": _f(getattr(getattr(community, "settings", None), "water_loss_target_percent", 20)),
            "active_meters": meters.filter(status="ACTIVE").count(), "faulty_meters": meters.filter(status__in=["FAULTY", "BLOCKED"]).count(),
            "available_meters": meters.filter(status="AVAILABLE").count(), "smart_meters": meters.filter(is_smart=True).count(),
            "reading_coverage": {"read": coverage_read, "total": coverage_total, "percent": round(coverage_read / coverage_total * 100) if coverage_total else 0},
            "pending_readings": readings.filter(status="PENDING").count(), "flagged_readings": readings.filter(is_anomalous=True, status="PENDING").count(),
            "assets_total": assets.count(), "assets_degraded": assets.filter(status__in=["DEGRADED", "FAILED", "UNDER_MAINTENANCE"]).count(),
            "maintenance_overdue": assets.filter(next_maintenance__lt=today).count(), "maintenance_due_30": due_assets.count(),
            "active_outages": Outage.objects.filter(community=community, status="ACTIVE").count(), "outage_hours_90d": round(outage_hours_90, 1),
            "quality_alerts_90d": WaterQualityTest.objects.filter(community=community, tested_on__gte=today - timedelta(days=90)).exclude(compliance_status="COMPLIANT").count(),
            "meter_replacements_90d": replacements,
            "open_emergencies": Emergency.objects.filter(community=community, status__in=["OPEN", "RESPONDING"]).count(),
        },
        "daily": daily,
        "nrw_trend": nrw_trend,
        "analytics": {
            "consumption_by_category": cons_by_cat, "coverage_trend": coverage_trend, "anomaly_trend": anomaly_trend,
            "consumption_trend": monthly_trend(community, 6), "avg_m3_per_connection": avg_per_connection, "litres_per_person_per_day": lpcd,
        },
        "meters_by_status": list(meters.values("status").annotate(count=Count("id")).order_by("-count")),
        "assets_by_status": list(assets.values("status").annotate(count=Count("id")).order_by("-count")),
        "assets_by_type": list(assets.values("asset_type").annotate(count=Count("id")).order_by("-count")),
        "anomaly_flags": [{"flag": k, "count": v} for k, v in flag_counts.most_common()],
        "routes": routes,
        "maintenance_due": [_asset_brief(a, today) for a in due_assets[:10]],
        "quality": [
            {"id": q.id, "tested_on": q.tested_on, "testing_location": q.testing_location, "laboratory": q.laboratory, "ph": q.ph, "turbidity_ntu": q.turbidity_ntu,
             "chlorine_mg_l": q.chlorine_mg_l, "tds_mg_l": q.tds_mg_l, "ecoli_cfu": q.ecoli_cfu, "compliance_status": q.compliance_status, "issues": q.evaluate()}
            for q in quality
        ],
        "quality_history": [{"month": r["m"].strftime("%b"), "tests": r["tests"], "compliant": r["compliant"]} for r in quality_history],
        "outages": [
            {"id": o.id, "cause": o.cause, "affected_area": o.affected_area, "asset_name": o.asset.name if o.asset_id else None, "status": o.status,
             "started_at": o.started_at, "restored_at": o.restored_at, "expected_restoration": o.expected_restoration,
             "duration_hours": _hours_between(o.started_at, o.restored_at or timezone.now()), "customers_notified": o.customers_notified}
            for o in outages
        ],
        "top_consumers": [
            {"id": r["customer__id"], "household": r["customer__household_name"], "customer_id": r["customer__customer_id"], "category": r["customer__category"], "m3": _f(r["m3"])}
            for r in top_consumers
        ],
        "flagged_readings": [
            {"id": r.id, "meter": r.meter_id, "meter_code": r.meter.meter_id, "customer_name": r.customer.household_name if r.customer_id else None,
             "reading_date": r.reading_date, "previous_reading": r.previous_reading, "reading_value": r.reading_value, "consumption": r.consumption,
             "anomaly_flags": r.anomaly_flags, "anomaly_note": r.anomaly_note, "read_by_name": r.read_by.full_name if r.read_by_id else None, "gps_distance_m": r.gps_distance_m}
            for r in flagged
        ],
        "score": sustainability_score(community),
    }


# --------------------------------------------------------------------------------------
# Meter reader
# --------------------------------------------------------------------------------------

def meter_reader_dashboard(user):
    today = timezone.localdate()
    mstart, mend = _month_bounds()
    community = user.community
    mine = MeterReading.objects.filter(community=community, read_by=user)

    month_ids = set(mine.filter(reading_date__gte=mstart, reading_date__lt=mend).values_list("customer_id", flat=True))
    routes_out = []
    total_stops = done_stops = 0
    for r in ReadingRoute.objects.filter(community=community, reader=user, is_active=True).prefetch_related("customers__meters"):
        stops = []
        for c in r.customers.all().order_by("household_name"):
            meter = c.active_meter
            last = MeterReading.objects.filter(meter=meter).exclude(status="REJECTED").order_by("-reading_date", "-id").first() if meter else None
            stops.append({
                "customer": c.id, "customer_id": c.customer_id, "household": c.household_name, "phone": c.phone, "address": c.address, "category": c.category,
                "latitude": c.latitude, "longitude": c.longitude,
                "meter": meter.id if meter else None, "meter_id": meter.meter_id if meter else None, "meter_status": meter.status if meter else None,
                "previous_reading": str(last.reading_value if last else (meter.initial_reading if meter else "0")),
                "previous_date": last.reading_date if last else None,
                "avg_consumption": _f(MeterReading.objects.filter(meter=meter, status__in=["VALIDATED", "BILLED"]).aggregate(a=Avg("consumption"))["a"]) if meter else 0.0,
                "read_this_month": c.id in month_ids,
                "last_status": last.status if last else None, "last_flags": last.anomaly_flags if last else [],
            })
        done = len([s for s in stops if s["read_this_month"]])
        total_stops += len(stops)
        done_stops += done
        routes_out.append({"route": r.id, "name": r.name, "schedule_note": r.schedule_note, "households": len(stops), "read": done, "stops": stops})

    recent = mine.select_related("meter", "customer").order_by("-reading_date", "-id")[:12]
    status_mix = Counter(mine.filter(reading_date__gte=mstart).values_list("status", flat=True))
    daily = _daily_series(mine, "created_at", None, 14, today)

    return {
        "reader": {"id": user.id, "name": user.full_name, "community": community.name if community else None},
        "kpis": {
            "households_on_route": total_stops, "read_this_month": done_stops, "remaining": total_stops - done_stops,
            "progress": round(done_stops / total_stops * 100) if total_stops else 0,
            "today": mine.filter(reading_date=today).count(),
            "pending_validation": mine.filter(status="PENDING").count(), "flagged": mine.filter(is_anomalous=True, status="PENDING").count(),
            "rejected_month": status_mix.get("REJECTED", 0), "validated_month": status_mix.get("VALIDATED", 0) + status_mix.get("BILLED", 0),
            "days_left_in_month": (mend - today).days,
        },
        "routes": routes_out,
        "recent": [
            {"id": r.id, "meter_code": r.meter.meter_id, "household": r.customer.household_name if r.customer_id else None, "reading_date": r.reading_date,
             "previous_reading": r.previous_reading, "reading_value": r.reading_value, "consumption": r.consumption, "status": r.status,
             "anomaly_flags": r.anomaly_flags, "anomaly_note": r.anomaly_note, "source": r.source}
            for r in recent
        ],
        "daily_activity": [{"date": d["date"], "count": d["count"]} for d in daily],
    }


# --------------------------------------------------------------------------------------
# Technician
# --------------------------------------------------------------------------------------

def technician_dashboard(user):
    today = timezone.localdate()
    community = user.community
    now = timezone.now()
    tickets = ServiceRequest.objects.filter(community=community).select_related("customer", "assigned_to")
    mine = tickets.filter(assigned_to=user)
    mine_open = mine.exclude(status__in=["CLOSED", "CANCELLED", "RESOLVED"])
    field_categories = ["NO_WATER", "METER_FAULT", "LEAK", "NEW_CONNECTION", "DISCONNECTION", "METER_REPLACEMENT"]
    unassigned_field = tickets.filter(assigned_to__isnull=True, status="OPEN", category__in=field_categories)

    assets = Asset.objects.filter(community=community).exclude(status="DECOMMISSIONED").select_related("parent")
    overdue = assets.filter(next_maintenance__lt=today).order_by("next_maintenance")
    due_soon = assets.filter(next_maintenance__gte=today, next_maintenance__lte=today + timedelta(days=14)).order_by("next_maintenance")
    my_maintenance = MaintenanceRecord.objects.filter(community=community, technician=user).select_related("asset").order_by("-performed_on")[:8]
    month_start = today.replace(day=1)
    maint_month = MaintenanceRecord.objects.filter(community=community, technician=user, performed_on__gte=month_start)

    resolved_30 = mine.filter(resolved_at__gte=now - timedelta(days=30))
    avg_hours = None
    if resolved_30.exists():
        hours = [(t.resolved_at - t.created_at).total_seconds() / 3600 for t in resolved_30 if t.resolved_at]
        avg_hours = round(sum(hours) / len(hours), 1) if hours else None

    return {
        "technician": {"id": user.id, "name": user.full_name, "community": community.name if community else None},
        "kpis": {
            "my_open_tickets": mine_open.count(), "my_urgent": mine_open.filter(priority__in=["URGENT", "HIGH"]).count(),
            "unassigned_field_tickets": unassigned_field.count(),
            "resolved_30d": resolved_30.count(), "avg_resolution_hours": avg_hours,
            "maintenance_overdue": overdue.count(), "maintenance_due_14d": due_soon.count(),
            "jobs_this_month": maint_month.count(), "cost_this_month": _f(maint_month.aggregate(s=Sum("cost"))["s"]),
            "active_outages": Outage.objects.filter(community=community, status="ACTIVE").count(),
            "faulty_meters": Meter.objects.filter(community=community, status__in=["FAULTY", "BLOCKED"]).count(),
            "open_emergencies": Emergency.objects.filter(community=community, status__in=["OPEN", "RESPONDING"]).count(),
        },
        "my_tickets": [_ticket_brief(t) for t in mine_open.order_by("-priority", "created_at")[:12]],
        "unassigned": [_ticket_brief(t) for t in unassigned_field.order_by("-priority", "created_at")[:8]],
        "tickets_by_status": list(mine.values("status").annotate(count=Count("id")).order_by("-count")),
        "maintenance_overdue": [_asset_brief(a, today) for a in overdue[:8]],
        "maintenance_due": [_asset_brief(a, today) for a in due_soon[:8]],
        "assets_by_status": list(assets.values("status").annotate(count=Count("id")).order_by("-count")),
        "my_recent_maintenance": [
            {"id": m.id, "asset_name": m.asset.name, "asset_code": m.asset.asset_id, "maintenance_type": m.maintenance_type, "performed_on": m.performed_on,
             "description": m.description, "cost": _f(m.cost), "downtime_hours": _f(m.downtime_hours), "was_failure": m.was_failure}
            for m in my_maintenance
        ],
        "outages": [
            {"id": o.id, "cause": o.cause, "affected_area": o.affected_area, "asset_name": o.asset.name if o.asset_id else None, "status": o.status,
             "started_at": o.started_at, "expected_restoration": o.expected_restoration, "duration_hours": _hours_between(o.started_at, o.restored_at or now)}
            for o in Outage.objects.filter(community=community).select_related("asset").order_by("-started_at")[:6]
        ],
        "faulty_meters": [
            {"id": m.id, "meter_id": m.meter_id, "serial_number": m.serial_number, "status": m.status, "condition": m.condition,
             "customer_name": m.customer.household_name if m.customer_id else None, "installation_location": m.installation_location}
            for m in Meter.objects.filter(community=community, status__in=["FAULTY", "BLOCKED"]).select_related("customer")[:8]
        ],
        "emergencies": [
            {"id": e.id, "title": e.title, "emergency_type": e.emergency_type, "severity": e.severity, "status": e.status, "declared_at": e.declared_at}
            for e in Emergency.objects.filter(community=community, status__in=["OPEN", "RESPONDING"]).order_by("-declared_at")[:5]
        ],
    }


# --------------------------------------------------------------------------------------
# Customer support
# --------------------------------------------------------------------------------------

def support_dashboard(community):
    today = timezone.localdate()
    now = timezone.now()
    tickets = ServiceRequest.objects.filter(community=community).select_related("customer", "assigned_to")
    open_q = tickets.filter(status__in=["OPEN", "ASSIGNED", "IN_PROGRESS"])
    resolved_30 = tickets.filter(resolved_at__gte=now - timedelta(days=30))

    hours = [(t.resolved_at - t.created_at).total_seconds() / 3600 for t in resolved_30 if t.resolved_at]
    avg_resolution = round(sum(hours) / len(hours), 1) if hours else None
    rated = tickets.filter(satisfaction_rating__isnull=False)
    csat = rated.aggregate(a=Avg("satisfaction_rating"))["a"]
    sla_breached = open_q.filter(Q(priority="URGENT", created_at__lt=now - timedelta(hours=4)) | Q(priority="HIGH", created_at__lt=now - timedelta(hours=24)) | Q(priority__in=["MEDIUM", "LOW"], created_at__lt=now - timedelta(hours=72)))

    notifications = Notification.objects.filter(community=community, created_at__gte=now - timedelta(days=7))
    delivery = list(notifications.values("channel", "status").annotate(count=Count("id")).order_by("channel"))

    daily_tickets = _daily_series(tickets, "created_at", None, 14, today)

    return {
        "kpis": {
            "open": open_q.count(), "unassigned": open_q.filter(assigned_to__isnull=True).count(), "urgent": open_q.filter(priority="URGENT").count(),
            "sla_breached": sla_breached.count(), "new_today": tickets.filter(created_at__date=today).count(),
            "resolved_30d": resolved_30.count(), "avg_resolution_hours": avg_resolution,
            "csat": round(float(csat), 2) if csat else None, "csat_responses": rated.count(),
            "active_outages": Outage.objects.filter(community=community, status="ACTIVE").count(),
            "notifications_7d": notifications.count(), "notifications_failed_7d": notifications.filter(status="FAILED").count(),
            "customers": Customer.objects.filter(community=community).count(), "new_customers_30d": Customer.objects.filter(community=community, created_at__gte=now - timedelta(days=30)).count(),
        },
        "by_status": list(tickets.values("status").annotate(count=Count("id")).order_by("-count")),
        "by_category": list(open_q.values("category").annotate(count=Count("id")).order_by("-count")),
        "by_priority": list(open_q.values("priority").annotate(count=Count("id")).order_by("-count")),
        "workload": list(open_q.filter(assigned_to__isnull=False).values("assigned_to__full_name", "assigned_to__role").annotate(count=Count("id")).order_by("-count")[:8]),
        "daily_tickets": daily_tickets,
        "queue": [_ticket_brief(t) for t in open_q.order_by("-priority", "created_at")[:12]],
        "sla_breached": [_ticket_brief(t) for t in sla_breached.order_by("created_at")[:8]],
        "recent_resolved": [_ticket_brief(t) for t in tickets.filter(status__in=["RESOLVED", "CLOSED"]).order_by("-resolved_at")[:6]],
        "delivery": delivery,
        "outages": [
            {"id": o.id, "cause": o.cause, "affected_area": o.affected_area, "started_at": o.started_at, "expected_restoration": o.expected_restoration, "customers_notified": o.customers_notified}
            for o in Outage.objects.filter(community=community, status="ACTIVE").order_by("-started_at")
        ],
        "recent_customers": [_customer_brief(c) for c in Customer.objects.filter(community=community).order_by("-created_at")[:6]],
    }


# --------------------------------------------------------------------------------------
# Auditor
# --------------------------------------------------------------------------------------

def auditor_dashboard(community=None):
    today = timezone.localdate()
    now = timezone.now()
    logs = AuditLog.objects.all() if community is None else AuditLog.objects.filter(community=community)
    approvals = ApprovalRequest.objects.all() if community is None else ApprovalRequest.objects.filter(community=community)
    payments = Payment.objects.all() if community is None else Payment.objects.filter(community=community)
    adjustments = BillAdjustment.objects.all() if community is None else BillAdjustment.objects.filter(community=community)
    refunds = Refund.objects.all() if community is None else Refund.objects.filter(community=community)
    ledger = LedgerEntry.objects.all() if community is None else LedgerEntry.objects.filter(community=community)

    logs_30 = logs.filter(created_at__gte=now - timedelta(days=30))
    by_action = list(logs_30.values("action").annotate(count=Count("id")).order_by("-count"))
    by_actor = list(logs_30.exclude(actor__isnull=True).values("actor__full_name", "actor__role").annotate(count=Count("id")).order_by("-count")[:8])
    by_model = list(logs_30.values("model_name").annotate(count=Count("id")).order_by("-count")[:8])
    daily = _daily_series(logs, "created_at", None, 30, today)

    after_hours = logs_30.filter(Q(created_at__hour__lt=6) | Q(created_at__hour__gte=21)).count()
    self_reviewed = approvals.filter(reviewed_by=F("requested_by")).count()

    sensitive = (
        [{"kind": "ADJUSTMENT", "when": a.created_at, "amount": _f(a.amount), "label": a.bill.invoice_number, "who": a.approved_by.full_name if a.approved_by_id else None, "reason": a.reason, "community": a.community.name}
         for a in adjustments.select_related("bill", "approved_by", "community").order_by("-created_at")[:8]]
        + [{"kind": "REFUND", "when": r.created_at, "amount": _f(r.amount), "label": r.payment.reference, "who": r.approved_by.full_name if r.approved_by_id else None, "reason": r.reason, "community": r.community.name}
           for r in refunds.select_related("payment", "approved_by", "community").order_by("-created_at")[:8]]
        + [{"kind": "REVERSAL", "when": p.updated_at, "amount": _f(p.amount), "label": p.reference, "who": p.recorded_by.full_name if p.recorded_by_id else None, "reason": p.notes, "community": p.community.name}
           for p in payments.filter(status="REVERSED").select_related("recorded_by", "community").order_by("-updated_at")[:8]]
        + [{"kind": "WRITE_OFF", "when": e.created_at, "amount": _f(e.credit), "label": e.reference, "who": None, "reason": e.description, "community": e.community.name}
           for e in ledger.filter(entry_type="WRITE_OFF").select_related("community").order_by("-created_at")[:8]]
    )
    sensitive.sort(key=lambda x: x["when"], reverse=True)

    return {
        "scope": community.name if community else "All communities",
        "kpis": {
            "events_30d": logs_30.count(), "events_today": logs.filter(created_at__date=today).count(), "actors_30d": logs_30.exclude(actor__isnull=True).values("actor").distinct().count(),
            "logins_30d": logs_30.filter(action="LOGIN").count(), "deletes_30d": logs_30.filter(action="DELETE").count(), "after_hours_30d": after_hours,
            "approvals_pending": approvals.filter(status="PENDING").count(), "approvals_executed_30d": approvals.filter(status="EXECUTED", reviewed_at__gte=now - timedelta(days=30)).count(),
            "approvals_rejected_30d": approvals.filter(status="REJECTED", reviewed_at__gte=now - timedelta(days=30)).count(), "approvals_failed": approvals.filter(status="FAILED").count(),
            "self_reviewed": self_reviewed,
            "adjustments_30d": _f(adjustments.filter(created_at__gte=now - timedelta(days=30)).aggregate(s=Sum("amount"))["s"]),
            "refunds_30d": _f(refunds.filter(created_at__gte=now - timedelta(days=30)).aggregate(s=Sum("amount"))["s"]),
            "reversals_30d": payments.filter(status="REVERSED", updated_at__gte=now - timedelta(days=30)).count(),
            "write_offs_30d": _f(ledger.filter(entry_type="WRITE_OFF", created_at__gte=now - timedelta(days=30)).aggregate(s=Sum("credit"))["s"]),
        },
        "by_action": by_action, "by_actor": by_actor, "by_model": by_model, "daily": daily,
        "approvals_by_status": list(approvals.values("status").annotate(count=Count("id")).order_by("-count")),
        "approvals_by_type": list(approvals.values("request_type").annotate(count=Count("id")).order_by("-count")),
        "sensitive": sensitive[:15],
        "recent": activity_feed(community, limit=15),
    }


# --------------------------------------------------------------------------------------
# Activity feed (shared)
# --------------------------------------------------------------------------------------

_VERBS = {
    "CREATE": "created", "UPDATE": "updated", "DELETE": "deleted", "LOGIN": "signed in", "APPROVE": "approved", "REJECT": "rejected",
    "PAYMENT": "recorded a payment", "REVERSE": "reversed", "REFUND": "refunded", "GENERATE_BILLS": "generated bills for", "VALIDATE": "validated",
    "REPLACE": "replaced", "EXECUTE": "executed",
    "READING_RECORDED": "recorded reading", "READING_VALIDATED": "validated reading", "READING_REJECTED": "rejected reading",
    "BILL_GENERATED": "issued bill", "BILL_RUN": "ran billing for", "BILL_ADJUSTED": "adjusted bill", "BILL_CANCELLED": "cancelled bill",
    "PAYMENT_RECORDED": "recorded payment", "PAYMENT_REVERSED": "reversed payment", "REFUND_ISSUED": "refunded", "DEBT_WRITTEN_OFF": "wrote off debt for",
    "APPROVAL_DECIDED": "decided approval", "METER_REPLACED": "replaced meter", "OUTAGE_DECLARED": "declared outage", "OUTAGE_RESTORED": "restored supply",
    "DUNNING_RUN": "ran dunning for", "APPROVAL_APPROVED": "approved request", "APPROVAL_REJECTED": "rejected request", "DEBT_WRITE_OFF": "wrote off debt for",
    "TARIFF_CHANGED": "changed tariff", "NOTIFICATION_SENT": "sent notification to", "DISCONNECTION": "disconnected", "RECONNECTION": "reconnected",
}
# Actions whose verb already names the object type, so the model name would be redundant.
_NOUN_ACTIONS = {k for k in _VERBS if "_" in k} | {"PAYMENT", "GENERATE_BILLS", "VALIDATE", "REPLACE"}
_MODEL_LABELS = {
    "MeterReading": "reading", "BillingPeriod": "billing period", "ServiceRequest": "service request", "TariffPlan": "tariff plan", "ReadingRoute": "reading route",
    "ApprovalRequest": "approval request", "MaintenanceRecord": "maintenance record", "WaterQualityTest": "water-quality test", "WaterProduction": "production log",
}


def activity_feed(community=None, limit=20, user=None, platform_only=False):
    qs = AuditLog.objects.select_related("actor", "community")
    if platform_only:
        qs = qs.filter(community__isnull=True)      # registrations, plans, platform accounts — never a community's own activity
    elif community is not None:
        qs = qs.filter(community=community)
    if user is not None:
        qs = qs.filter(actor=user)
    out = []
    for l in qs.order_by("-created_at")[:limit]:
        verb = _VERBS.get(l.action, l.action.lower().replace("_", " "))
        if l.action == "LOGIN":
            subject = ""
        elif l.action in _NOUN_ACTIONS:
            subject = l.object_label or ""            # "recorded a reading MTR-000004" reads better than "... MeterReading MTR-000004"
        else:
            subject = f"{_MODEL_LABELS.get(l.model_name, l.model_name)} {l.object_label}".strip() if l.model_name else ""
        out.append({
            "id": l.id, "created_at": l.created_at, "action": l.action, "actor": l.actor_label or "system", "actor_role": l.actor.role if l.actor_id else None,
            "model_name": l.model_name, "object_label": l.object_label, "object_id": l.object_id, "community": l.community.name if l.community_id else None,
            "text": f"{l.actor_label or 'System'} {verb} {subject}".strip(), "reason": l.reason, "changed_fields": list((l.changes or {}).keys())[:6],
        })
    return out


# --------------------------------------------------------------------------------------
# Front desk collector
# --------------------------------------------------------------------------------------

def front_desk_dashboard(user):
    """
    The cashier's day: what I have taken today (by channel), this week, my last receipts, and
    the community's collection pulse so the desk knows how busy it will be.
    """
    today = timezone.localdate()
    community = user.community
    mine = Payment.objects.filter(community=community, recorded_by=user, status="SUCCESSFUL").select_related("customer")
    today_q = mine.filter(paid_at__date=today)
    week_start = today - timedelta(days=today.weekday())
    week_q = mine.filter(paid_at__date__gte=week_start)
    mstart, _ = _month_bounds()
    all_today = Payment.objects.filter(community=community, status="SUCCESSFUL", paid_at__date=today)
    by_method_today = list(today_q.values("method").annotate(total=Sum("amount"), count=Count("id")).order_by("-total"))
    reversed_today = Payment.objects.filter(community=community, recorded_by=user, status="REVERSED", updated_at__date=today).count()
    overdue_customers = Customer.objects.filter(community=community, outstanding_balance__gt=0).count()
    return {
        "collector": {"id": user.id, "name": user.full_name, "community": community.name},
        "kpis": {
            "today_total": _f(today_q.aggregate(s=Sum("amount"))["s"]), "today_count": today_q.count(),
            "today_cash": _f(today_q.filter(method="CASH").aggregate(s=Sum("amount"))["s"]),
            "today_momo": _f(today_q.filter(method__in=["MOBILE_MONEY", "USSD"]).aggregate(s=Sum("amount"))["s"]),
            "week_total": _f(week_q.aggregate(s=Sum("amount"))["s"]), "week_count": week_q.count(),
            "month_total": _f(mine.filter(paid_at__date__gte=mstart).aggregate(s=Sum("amount"))["s"]),
            "community_today_total": _f(all_today.aggregate(s=Sum("amount"))["s"]), "community_today_count": all_today.count(),
            "reversed_today": reversed_today, "customers_owing": overdue_customers,
            "outstanding_total": _f(Customer.objects.filter(community=community).aggregate(s=Sum("outstanding_balance"))["s"]),
        },
        "by_method_today": by_method_today,
        "daily": _daily_series(mine, "paid_at", "amount", 14, today),
        "recent": [
            {"id": p.id, "reference": p.reference, "customer": p.customer_id, "customer_name": p.customer.household_name, "customer_code": p.customer.customer_id,
             "amount": _f(p.amount), "method": p.method, "paid_at": p.paid_at, "receipt_number": getattr(getattr(p, "receipt", None), "receipt_number", None)}
            for p in mine.order_by("-paid_at")[:15]
        ],
    }
