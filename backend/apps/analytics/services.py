"""Dashboards, benchmarking, sustainability scoring and the rule-based water intelligence engine."""
from datetime import timedelta
from decimal import Decimal
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.billing.models import Bill
from apps.communities.models import Community
from apps.customers.models import Customer
from apps.infrastructure.models import Asset, Emergency, MaintenanceRecord, Outage, WaterQualityTest
from apps.meters.models import Meter, MeterReading
from apps.payments.models import Payment
from apps.tickets.models import ServiceRequest
from .models import WaterProduction


def _f(v):
    return float(v or 0)


def _month_bounds(dt=None):
    today = dt or timezone.localdate()
    start = today.replace(day=1)
    nxt = (start + timedelta(days=32)).replace(day=1)
    return start, nxt


def water_loss_percent(community, start, end):
    produced = WaterProduction.objects.filter(community=community, date__gte=start, date__lt=end).aggregate(s=Sum("volume_m3"))["s"] or Decimal("0")
    consumed = MeterReading.objects.filter(community=community, reading_date__gte=start, reading_date__lt=end, status__in=["VALIDATED", "BILLED"], consumption__gt=0).aggregate(s=Sum("consumption"))["s"] or Decimal("0")
    if produced <= 0:
        return None, _f(produced), _f(consumed)
    return round(float((produced - consumed) / produced * 100), 1), _f(produced), _f(consumed)


def collection_efficiency(community, start=None, end=None):
    bq = Bill.objects.filter(community=community).exclude(status="CANCELLED")
    pq = Payment.objects.filter(community=community, status="SUCCESSFUL")
    if start:
        bq, pq = bq.filter(issued_at__date__gte=start), pq.filter(paid_at__date__gte=start)
    if end:
        bq, pq = bq.filter(issued_at__date__lt=end), pq.filter(paid_at__date__lt=end)
    billed = _f(bq.aggregate(s=Sum("current_charges"))["s"])
    collected = _f(pq.aggregate(s=Sum("amount"))["s"])
    return (round(collected / billed * 100, 1) if billed else None), billed, collected


def community_dashboard(community):
    today = timezone.localdate()
    mstart, mend = _month_bounds()
    customers = Customer.objects.filter(community=community)
    meters = Meter.objects.filter(community=community)
    eff, billed_m, collected_m = collection_efficiency(community, mstart, mend)
    loss, produced, consumed = water_loss_percent(community, mstart, mend)
    outstanding = _f(customers.aggregate(s=Sum("outstanding_balance"))["s"])
    today_cons = _f(MeterReading.objects.filter(community=community, reading_date=today, status__in=["VALIDATED", "BILLED", "PENDING"], consumption__gt=0).aggregate(s=Sum("consumption"))["s"])
    trend = monthly_trend(community, 6)
    return {
        "community": {"id": community.id, "name": community.name, "code": community.code, "status": community.service_status},
        "overview": {
            "total_customers": customers.count(), "active_connections": customers.filter(account_status="ACTIVE").count(),
            "disconnected": customers.filter(account_status="DISCONNECTED").count(), "meters": meters.count(), "active_meters": meters.filter(status="ACTIVE").count(),
            "faulty_meters": meters.filter(status__in=["FAULTY", "BLOCKED"]).count(),
            "today_consumption_m3": today_cons, "monthly_consumption_m3": consumed, "monthly_production_m3": produced,
            "bills_generated": billed_m, "collected": collected_m, "outstanding": outstanding, "collection_efficiency": eff, "water_loss_percent": loss,
        },
        "alerts": {
            "pending_readings": MeterReading.objects.filter(community=community, status="PENDING").count(),
            "anomalous_readings": MeterReading.objects.filter(community=community, is_anomalous=True, status="PENDING").count(),
            "high_risk_customers": customers.filter(risk_level="HIGH").count(),
            "overdue_bills": Bill.objects.filter(community=community, status="OVERDUE").count(),
            "open_tickets": ServiceRequest.objects.filter(community=community, status__in=["OPEN", "ASSIGNED", "IN_PROGRESS"]).count(),
            "active_outages": Outage.objects.filter(community=community, status="ACTIVE").count(),
            "maintenance_due": Asset.objects.filter(community=community, next_maintenance__lte=today + timedelta(days=14)).exclude(status="DECOMMISSIONED").count(),
            "pending_approvals": community.approvalrequests.filter(status="PENDING").count(),
            "quality_alerts": WaterQualityTest.objects.filter(community=community, tested_on__gte=today - timedelta(days=90)).exclude(compliance_status="COMPLIANT").count(),
            "open_emergencies": Emergency.objects.filter(community=community, status__in=["OPEN", "RESPONDING"]).count(),
        },
        "trend": trend,
        "payment_methods": list(Payment.objects.filter(community=community, status="SUCCESSFUL", paid_at__date__gte=mstart).values("method").annotate(total=Sum("amount"), count=Count("id")).order_by("-total")),
        "by_category": list(customers.values("category").annotate(count=Count("id"), outstanding=Sum("outstanding_balance")).order_by("-count")),
        "score": sustainability_score(community),
    }


def _months_back(months):
    """First day of the month `months-1` months ago, so a series of `months` points ends on the current month."""
    cur = timezone.localdate().replace(day=1)
    for _ in range(months - 1):
        cur = (cur - timedelta(days=1)).replace(day=1)
    return cur


def monthly_trend(community, months=6):
    start = _months_back(months)
    billed = {r["m"].strftime("%Y-%m"): _f(r["s"]) for r in Bill.objects.filter(community=community, issued_at__date__gte=start).exclude(status="CANCELLED").annotate(m=TruncMonth("issued_at")).values("m").annotate(s=Sum("current_charges")).order_by("m")}
    collected = {r["m"].strftime("%Y-%m"): _f(r["s"]) for r in Payment.objects.filter(community=community, status="SUCCESSFUL", paid_at__date__gte=start).annotate(m=TruncMonth("paid_at")).values("m").annotate(s=Sum("amount")).order_by("m")}
    consumed = {r["m"].strftime("%Y-%m"): _f(r["s"]) for r in MeterReading.objects.filter(community=community, reading_date__gte=start, status__in=["VALIDATED", "BILLED"], consumption__gt=0).annotate(m=TruncMonth("reading_date")).values("m").annotate(s=Sum("consumption")).order_by("m")}
    out, cur = [], start
    for _ in range(months):
        k = cur.strftime("%Y-%m")
        out.append({"month": cur.strftime("%b %Y"), "key": k, "billed": billed.get(k, 0), "collected": collected.get(k, 0), "consumption": consumed.get(k, 0)})
        cur = (cur + timedelta(days=32)).replace(day=1)
    return out


def sustainability_score(community):
    """Community Water Sustainability Score (0–100) from seven weighted components."""
    today = timezone.localdate()
    q_start = today - timedelta(days=90)
    eff, _, _ = collection_efficiency(community, q_start, None)
    loss, produced, _ = water_loss_percent(community, q_start, today + timedelta(days=1))
    outage_hours = 0.0
    for o in Outage.objects.filter(community=community, started_at__date__gte=q_start):
        end = o.restored_at or timezone.now()
        outage_hours += max(0.0, (end - o.started_at).total_seconds() / 3600)
    availability = max(0.0, 100 - outage_hours / (90 * 24) * 100)
    tests = WaterQualityTest.objects.filter(community=community, tested_on__gte=q_start)
    quality = (tests.filter(compliance_status="COMPLIANT").count() / tests.count() * 100) if tests.exists() else 70.0
    assets = Asset.objects.filter(community=community).exclude(status="DECOMMISSIONED")
    reliability = (assets.filter(status="OPERATIONAL").count() / assets.count() * 100) if assets.exists() else 70.0
    overdue = assets.filter(next_maintenance__lt=today).count()
    maintenance = max(0.0, 100 - (overdue / assets.count() * 100)) if assets.exists() else 70.0
    rated = ServiceRequest.objects.filter(community=community, satisfaction_rating__isnull=False, created_at__date__gte=q_start)
    satisfaction = (_f(rated.aggregate(a=Avg("satisfaction_rating"))["a"]) / 5 * 100) if rated.exists() else 70.0
    leakage = max(0.0, min(100.0, 100 - max(0.0, (loss if loss is not None else 15) - 10) * 2))  # 100 at ≤10% NRW, 0 at 60%
    components = {
        "collection_efficiency": {"value": eff if eff is not None else 70.0, "weight": 0.20},
        "water_availability": {"value": round(availability, 1), "weight": 0.15},
        "water_quality": {"value": round(quality, 1), "weight": 0.15},
        "infrastructure_reliability": {"value": round(reliability, 1), "weight": 0.15},
        "leakage_water_loss": {"value": round(leakage, 1), "weight": 0.15},
        "customer_satisfaction": {"value": round(satisfaction, 1), "weight": 0.10},
        "maintenance_performance": {"value": round(maintenance, 1), "weight": 0.10},
    }
    score = round(sum(min(100, max(0, c["value"])) * c["weight"] for c in components.values()))
    grade = "EXCELLENT" if score >= 85 else "GOOD" if score >= 70 else "FAIR" if score >= 50 else "AT RISK"
    return {"score": score, "grade": grade, "components": components}


def platform_dashboard():
    """
    Aggregate health view for platform staff. Deliberately contains no per-community money,
    customer or transaction detail: only counts, percentages and scores. Community activity is
    the community's own business (see core/roles.py).
    """
    communities = Community.objects.all()
    active = communities.filter(service_status="ACTIVE")
    rows = benchmark()
    scored = [r for r in rows if r["status"] == "ACTIVE"]
    avg = lambda key: round(sum(r[key] for r in scored if r[key] is not None) / max(1, len([r for r in scored if r[key] is not None])), 1) if scored else None
    grades = {"EXCELLENT": 0, "GOOD": 0, "FAIR": 0, "AT RISK": 0}
    for r in scored:
        grades[r["grade"]] = grades.get(r["grade"], 0) + 1
    by_region = list(communities.values("region").annotate(communities=Count("id", distinct=True), customers=Count("customers", distinct=True)).order_by("region"))
    by_system = list(communities.values("water_system_type").annotate(count=Count("id")).order_by("-count"))
    from apps.communities.models import SubscriptionPlan
    from apps.accounts.models import User as _User
    pending = [
        {"id": c.id, "name": c.name, "code": c.code, "region": c.region, "district": c.district, "water_system_type": c.water_system_type,
         "households_count": c.households_count, "towns": c.towns.count(), "contact_name": c.contact_name, "contact_phone": c.contact_phone,
         "registration_date": c.registration_date}
        for c in communities.filter(service_status="PENDING").order_by("registration_date")
    ]
    without_admin = [
        {"id": c.id, "name": c.name, "code": c.code, "region": c.region, "approved_at": c.approved_at}
        for c in active.filter(admin__isnull=True).order_by("-approved_at")
        if not _User.objects.filter(community=c, role="COMMUNITY_ADMIN", is_active=True).exists()
    ]
    plans = [
        {"id": p.id, "name": p.name, "monthly_price": _f(p.monthly_price), "max_customers": p.max_customers, "max_staff": p.max_staff, "is_active": p.is_active,
         "communities": p.communities.count(), "active_communities": p.communities.filter(service_status="ACTIVE").count(),
         "monthly_revenue": _f(p.monthly_price) * p.communities.filter(service_status="ACTIVE").count()}
        for p in SubscriptionPlan.objects.all().order_by("monthly_price")
    ]
    unassigned_plan = active.filter(subscription_plan__isnull=True).count()
    over_limit = []
    for c in active.select_related("subscription_plan"):
        if c.subscription_plan and c.customers.count() > c.subscription_plan.max_customers:
            over_limit.append({"id": c.id, "name": c.name, "customers": c.customers.count(), "limit": c.subscription_plan.max_customers, "plan": c.subscription_plan.name})
    recent = [
        {"id": c.id, "name": c.name, "region": c.region, "approved_at": c.approved_at, "status": c.service_status}
        for c in communities.exclude(service_status="PENDING").order_by("-approved_at")[:6]
    ]
    platform_staff = list(_User.objects.filter(role__in=["PLATFORM_SUPER_ADMIN", "PLATFORM_OPERATIONS_ADMIN"]).values("role").annotate(n=Count("id")))
    return {
        "pending": pending,
        "without_admin": without_admin,
        "plans": plans,
        "subscriptions": {"unassigned": unassigned_plan, "over_limit": over_limit, "monthly_recurring_revenue": round(sum(p["monthly_revenue"] for p in plans), 2)},
        "recent": recent,
        "platform_staff": platform_staff,
        "totals": {
            "communities": communities.count(), "active_communities": active.count(),
            "towns": sum(c.towns.count() for c in communities),
            "pending_communities": communities.filter(service_status="PENDING").count(),
            "suspended_communities": communities.filter(service_status="SUSPENDED").count(),
            "households_served": Customer.objects.filter(community__in=active).count(),
            "active_meters": Meter.objects.filter(community__in=active, status="ACTIVE").count(),
            "avg_collection_efficiency": avg("collection_efficiency"), "avg_water_loss_percent": avg("water_loss_percent"), "avg_score": avg("score"),
            "communities_with_outages": len([r for r in scored if r["outages"] > 0]),
            "communities_at_risk": grades.get("AT RISK", 0),
        },
        "grades": grades,
        "by_region": by_region,
        "by_system": by_system,
        "benchmark": rows,
        "monthly_onboarding": _onboarding_trend(6),
    }


def _onboarding_trend(months=6):
    """Communities approved per month — the platform's own growth line."""
    start = _months_back(months)
    rows = {r["m"].strftime("%Y-%m"): r["n"] for r in Community.objects.filter(approved_at__date__gte=start).annotate(m=TruncMonth("approved_at")).values("m").annotate(n=Count("id"))}
    out, cur = [], start
    for _ in range(months):
        out.append({"month": cur.strftime("%b %Y"), "approved": rows.get(cur.strftime("%Y-%m"), 0)})
        cur = (cur + timedelta(days=32)).replace(day=1)
    return out


def benchmark():
    """
    One row per community with health *indicators* only — ratios, counts and the sustainability
    score. No cedi amounts, so platform staff can rank communities without seeing their books.
    """
    mstart, mend = _month_bounds()
    rows = []
    for c in Community.objects.all():
        eff, _billed, _collected = collection_efficiency(c, mstart, mend)
        loss, _produced, _consumed = water_loss_percent(c, mstart, mend)
        score = sustainability_score(c)
        customers = c.customers.count()
        rows.append({
            "id": c.id, "name": c.name, "code": c.code, "region": c.region, "district": c.district, "status": c.service_status,
            "water_system_type": c.water_system_type, "approved_at": c.approved_at,
            "customers": customers, "active_meters": c.meters.filter(status="ACTIVE").count(),
            "metered_percent": round(c.customers.filter(meters__status="ACTIVE").distinct().count() / customers * 100) if customers else None,
            "collection_efficiency": eff, "water_loss_percent": loss,
            "outages": Outage.objects.filter(community=c, started_at__date__gte=mstart).count(),
            "open_tickets": ServiceRequest.objects.filter(community=c, status__in=["OPEN", "ASSIGNED", "IN_PROGRESS"]).count(),
            "quality_alerts": WaterQualityTest.objects.filter(community=c, tested_on__gte=mstart - timedelta(days=60)).exclude(compliance_status="COMPLIANT").count(),
            "score": score["score"], "grade": score["grade"], "components": {k: v["value"] for k, v in score["components"].items()},
        })
    rows.sort(key=lambda r: -(r["score"] or 0))
    return rows


def revenue_report(community, start, end):
    bills = Bill.objects.filter(community=community, issued_at__date__gte=start, issued_at__date__lt=end).exclude(status="CANCELLED")
    pays = Payment.objects.filter(community=community, status="SUCCESSFUL", paid_at__date__gte=start, paid_at__date__lt=end)
    eff, billed, collected = collection_efficiency(community, start, end)
    daily = list(pays.values("paid_at__date").annotate(total=Sum("amount"), count=Count("id")).order_by("paid_at__date"))
    return {
        "period": {"start": str(start), "end": str(end)},
        "billed": billed, "collected": collected, "collection_efficiency": eff,
        "breakdown": {k: _f(bills.aggregate(s=Sum(k))["s"]) for k in ("water_charge", "service_charge", "maintenance_levy", "infrastructure_levy", "penalty", "discount", "adjustment")},
        "by_tariff": list(bills.values("tariff_name").annotate(total=Sum("current_charges"), bills=Count("id")).order_by("-total")),
        "by_customer_type": list(bills.values("customer__category").annotate(total=Sum("current_charges"), bills=Count("id")).order_by("-total")),
        "by_method": list(pays.values("method").annotate(total=Sum("amount"), count=Count("id")).order_by("-total")),
        "daily": [{"date": str(d["paid_at__date"]), "total": _f(d["total"]), "count": d["count"]} for d in daily],
        "expenses": {"maintenance": _f(MaintenanceRecord.objects.filter(community=community, performed_on__gte=start, performed_on__lt=end).aggregate(s=Sum("cost"))["s"]),
                     "refunds": _f(community.refunds.filter(created_at__date__gte=start, created_at__date__lt=end).aggregate(s=Sum("amount"))["s"])},
        "outstanding_total": _f(Customer.objects.filter(community=community).aggregate(s=Sum("outstanding_balance"))["s"]),
    }


def intelligence(question: str, community=None):
    """Answers the platform's standard analytical questions from live data (no external AI required)."""
    q = (question or "").lower()
    mstart, mend = _month_bounds()
    if "loss" in q or "leak" in q and "communit" in q:
        rows = sorted([r for r in benchmark() if r["water_loss_percent"] is not None], key=lambda r: -r["water_loss_percent"])[:5]
        return {"answer": "Communities ranked by non-revenue water this month.", "data": rows}
    if "abnormal" in q or "anomal" in q or "household" in q and "consumption" in q:
        qs = MeterReading.objects.filter(is_anomalous=True).exclude(status="REJECTED")
        if community:
            qs = qs.filter(community=community)
        data = [{"customer": r.customer.household_name if r.customer else None, "customer_id": r.customer.customer_id if r.customer else None,
                 "community": r.community.name, "consumption": _f(r.consumption), "flags": r.anomaly_flags, "date": str(r.reading_date)} for r in qs.select_related("customer", "community")[:20]]
        return {"answer": f"{qs.count()} readings are currently flagged as anomalous.", "data": data}
    if "pump" in q or "fail" in q:
        qs = Asset.objects.filter(asset_type__in=["PUMP", "GENERATOR", "SOLAR"]).exclude(status="DECOMMISSIONED")
        if community:
            qs = qs.filter(community=community)
        scored = []
        today = timezone.localdate()
        for a in qs:
            failures = a.maintenance_records.filter(was_failure=True, performed_on__gte=today - timedelta(days=365)).count()
            overdue = (today - a.next_maintenance).days if a.next_maintenance and a.next_maintenance < today else 0
            age_years = ((today - a.installed_on).days / 365) if a.installed_on else 0
            risk = min(100, failures * 25 + min(overdue, 60) + int(age_years * 5) + (30 if a.status in ("DEGRADED", "FAILED") else 0))
            scored.append({"asset": a.name, "asset_id": a.asset_id, "community": a.community.name, "status": a.status, "failures_12m": failures, "days_overdue": overdue, "failure_risk": risk})
        scored.sort(key=lambda r: -r["failure_risk"])
        return {"answer": "Pumps and power assets ranked by failure likelihood (failure history, overdue maintenance, age, current status).", "data": scored[:10]}
    if "revenue" in q or "decline" in q:
        trend = monthly_trend(community, 6) if community else platform_trend(6)
        last, prev = trend[-1], trend[-2] if len(trend) > 1 else trend[-1]
        delta = last["collected"] - prev["collected"]
        reasons = []
        if last["billed"] < prev["billed"]:
            reasons.append("Less was billed this month (fewer validated readings or lower consumption).")
        if last["billed"] and last["collected"] / last["billed"] < (prev["collected"] / prev["billed"] if prev["billed"] else 1):
            reasons.append("Collection efficiency dropped: customers paid a smaller share of what was billed.")
        pending = MeterReading.objects.filter(status="PENDING", **({"community": community} if community else {})).count()
        if pending:
            reasons.append(f"{pending} readings are still pending validation and therefore unbilled.")
        return {"answer": f"Collections moved by GHS {delta:,.2f} versus last month." + (" Likely reasons: " + " ".join(reasons) if reasons else " No obvious driver in the data."), "data": trend}
    if "outstanding" in q or "debt" in q or "unpaid" in q:
        rows = sorted(benchmark(), key=lambda r: -r["outstanding"])[:5] if not community else \
            [{"customer": c.household_name, "customer_id": c.customer_id, "outstanding": _f(c.outstanding_balance), "status": c.account_status}
             for c in Customer.objects.filter(community=community).order_by("-outstanding_balance")[:10]]
        return {"answer": "Ranked by outstanding balance.", "data": rows}
    if "predict" in q or "demand" in q or "next month" in q:
        trend = monthly_trend(community, 6) if community else None
        if trend:
            vals = [t["consumption"] for t in trend if t["consumption"]]
            if len(vals) >= 2:
                weights = list(range(1, len(vals) + 1))
                forecast = sum(v * w for v, w in zip(vals, weights)) / sum(weights)
                growth = (vals[-1] - vals[0]) / len(vals)
                return {"answer": f"Forecast for next month: about {forecast + growth:,.0f} m³ (weighted moving average with trend).", "data": trend}
        return {"answer": "Not enough validated consumption history to forecast yet — at least two billed months are needed.", "data": trend or []}
    return {"answer": "Try: highest water losses, abnormal consumption, pumps likely to fail, revenue decline, highest outstanding bills, or predict next month's demand.", "data": []}
