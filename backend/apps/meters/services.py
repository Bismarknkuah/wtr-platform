"""
Meter lifecycle + reading engine.
  record_reading()  -> consumption calc, anomaly detection, GPS check, offline idempotency
  replace_meter()   -> old meter: final reading → REPLACED; new meter: initial reading → ACTIVE (full audit trail)
  compute_risk()    -> water-loss / tampering risk score per customer
"""
import math
from decimal import Decimal
from django.db import transaction
from django.db.models import Avg
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import log_action
from .models import Meter, MeterReading, MeterReplacement


def _haversine_m(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return None
    R = 6371000.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp, dl = math.radians(float(lat2) - float(lat1)), math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(2 * R * math.asin(math.sqrt(a)))


def detect_anomalies(meter: Meter, reading_value: Decimal, reading_date, previous: Decimal, settings_obj):
    """Rule-based anomaly detection. Returns (flags, consumption, note)."""
    flags, notes = [], []
    consumption = reading_value - previous
    history = list(MeterReading.objects.filter(meter=meter, status__in=["VALIDATED", "BILLED"], consumption__gt=0)
                   .order_by("-reading_date").values_list("consumption", flat=True)[:6])
    avg = (sum(history) / len(history)) if history else None

    if consumption < 0:
        flags.append("REVERSE_READING")
        notes.append(f"Reading {reading_value} is lower than previous {previous} (possible meter reset, tampering or entry error).")
    if MeterReading.objects.filter(meter=meter, reading_value=reading_value, reading_date=reading_date).exclude(status="REJECTED").exists():
        flags.append("DUPLICATE_READING")
    if consumption > Decimal("5000"):
        flags.append("IMPOSSIBLE_READING")
        notes.append("Consumption exceeds the physical plausibility limit.")
    if avg and avg > 0 and consumption > 0:
        pct = int((consumption / avg) * 100)
        if pct >= (settings_obj.anomaly_spike_percent if settings_obj else 200):
            flags.append("CONSUMPTION_SPIKE")
            notes.append(f"Possible water leak: consumption is {pct}% of the recent average ({avg:.1f} m³).")
        elif pct <= (settings_obj.anomaly_low_percent if settings_obj else 30):
            flags.append("UNUSUALLY_LOW")
            notes.append(f"Consumption is only {pct}% of the recent average — check for bypass or broken meter.")
    if consumption == 0:
        streak_needed = settings_obj.zero_consumption_streak if settings_obj else 3
        recent = list(MeterReading.objects.filter(meter=meter).exclude(status="REJECTED").order_by("-reading_date")
                      .values_list("consumption", flat=True)[: streak_needed - 1])
        if len(recent) >= streak_needed - 1 and all(c == 0 for c in recent):
            flags.append("REPEATED_ZERO_CONSUMPTION")
            notes.append("Zero consumption for several consecutive periods — possible bypass, vacancy or broken meter.")
    if meter.status in ("FAULTY", "BLOCKED", "REMOVED", "REPLACED", "RETIRED"):
        flags.append("METER_NOT_ACTIVE")
        notes.append(f"Meter is currently {meter.status.lower()}.")
    return flags, consumption, " ".join(notes)[:300]


@transaction.atomic
def record_reading(*, community, meter: Meter, reading_value, reading_date=None, read_by=None, source="MANUAL",
                   latitude=None, longitude=None, photo=None, photo_url="", device_id="", client_reading_id=None,
                   notes="", ocr_detected_value=None, auto_validate=False):
    reading_value = Decimal(str(reading_value))
    reading_date = reading_date or timezone.localdate()
    if meter.community_id != community.id:
        raise ValidationError({"meter": "Meter belongs to another community."})
    if client_reading_id:
        existing = MeterReading.objects.filter(client_reading_id=client_reading_id).first()
        if existing:
            return existing, False   # idempotent replay from an offline sync

    latest = MeterReading.objects.filter(meter=meter).exclude(status="REJECTED").order_by("-reading_date", "-id").first()
    previous = latest.reading_value if latest else meter.initial_reading
    settings_obj = getattr(community, "settings", None)
    flags, consumption, note = detect_anomalies(meter, reading_value, reading_date, previous, settings_obj)

    customer = meter.customer
    gps_dist = _haversine_m(latitude, longitude, customer.latitude if customer else None, customer.longitude if customer else None)
    if gps_dist is not None and gps_dist > 300:
        flags.append("GPS_MISMATCH")
        note = (note + f" Reader was {gps_dist} m from the registered household location.")[:300]

    reading = MeterReading.objects.create(
        community=community, meter=meter, customer=customer, reading_value=reading_value, previous_reading=previous,
        consumption=consumption, reading_date=reading_date, read_by=read_by, latitude=latitude, longitude=longitude,
        gps_distance_m=gps_dist, photo=photo, photo_url=photo_url or "", device_id=device_id or "",
        client_reading_id=client_reading_id or None, source=source, notes=notes or "",
        ocr_detected_value=ocr_detected_value, is_anomalous=bool(flags), anomaly_flags=flags, anomaly_note=note,
        status=MeterReading.Status.VALIDATED if (auto_validate and not flags) else MeterReading.Status.PENDING,
    )
    if reading.status == MeterReading.Status.VALIDATED:
        _apply_validated(reading, read_by)
    log_action("READING_RECORDED", reading, model_name="MeterReading", actor=read_by, changes={"reading": str(reading_value), "consumption": str(consumption), "flags": flags})
    if flags and customer:
        from apps.notifications.services import notify
        if "CONSUMPTION_SPIKE" in flags:
            notify("LEAK_DETECTED", community=community, customer=customer, context={"consumption": str(consumption)})
        compute_risk(customer)
    return reading, True


def _apply_validated(reading: MeterReading, user=None):
    meter = reading.meter
    if reading.consumption >= 0:
        meter.current_reading = reading.reading_value
        meter.save(update_fields=["current_reading", "updated_at"])
    reading.validated_by = user
    reading.validated_at = timezone.now()
    reading.save(update_fields=["validated_by", "validated_at"])


@transaction.atomic
def validate_reading(reading: MeterReading, user, approve: bool, note: str = ""):
    if reading.status == MeterReading.Status.BILLED:
        raise ValidationError("This reading has already been billed.")
    reading.status = MeterReading.Status.VALIDATED if approve else MeterReading.Status.REJECTED
    reading.notes = (reading.notes + f"\n[{user.full_name}] {note}").strip() if note else reading.notes
    reading.save(update_fields=["status", "notes"])
    if approve:
        _apply_validated(reading, user)
    log_action("READING_VALIDATED" if approve else "READING_REJECTED", reading, model_name="MeterReading", actor=user, reason=note)
    return reading


@transaction.atomic
def replace_meter(*, community, old_meter: Meter, new_meter: Meter, final_reading, initial_reading, reason, performed_by, performed_on=None):
    if old_meter.community_id != community.id or new_meter.community_id != community.id:
        raise ValidationError("Both meters must belong to this community.")
    if new_meter.status not in (Meter.Status.AVAILABLE, Meter.Status.INSTALLED):
        raise ValidationError({"new_meter": f"New meter must be AVAILABLE or INSTALLED (currently {new_meter.status})."})
    performed_on = performed_on or timezone.localdate()
    customer, prop = old_meter.customer, old_meter.property
    # 1. Final reading on the old meter (validated straight away – it's the closing reading)
    record_reading(community=community, meter=old_meter, reading_value=final_reading, reading_date=performed_on, read_by=performed_by,
                   source="MANUAL", notes=f"Final reading before replacement: {reason}", auto_validate=True)
    old_meter.status = Meter.Status.REPLACED
    old_meter.current_reading = final_reading
    old_meter.replaced_by = new_meter
    old_meter.customer = None
    old_meter.property = None
    old_meter.save()
    # 2. New meter takes over
    new_meter.customer, new_meter.property = customer, prop
    new_meter.initial_reading = new_meter.current_reading = Decimal(str(initial_reading))
    new_meter.installation_date = performed_on
    new_meter.installation_location = old_meter.installation_location
    new_meter.status = Meter.Status.ACTIVE
    new_meter.save()
    rep = MeterReplacement.objects.create(community=community, old_meter=old_meter, new_meter=new_meter, customer=customer,
                                          final_reading=final_reading, initial_reading=initial_reading, reason=reason,
                                          performed_by=performed_by, performed_on=performed_on)
    log_action("METER_REPLACED", rep, model_name="MeterReplacement", actor=performed_by, reason=reason,
               changes={"old_meter": old_meter.meter_id, "new_meter": new_meter.meter_id, "final": str(final_reading), "initial": str(initial_reading)})
    from apps.notifications.services import notify
    if customer:
        notify("METER_REPLACED", community=community, customer=customer, context={"old": old_meter.meter_id, "new": new_meter.meter_id})
    return rep


RISK_WEIGHTS = {"REVERSE_READING": 25, "REPEATED_ZERO_CONSUMPTION": 20, "UNUSUALLY_LOW": 12, "CONSUMPTION_SPIKE": 8,
                "GPS_MISMATCH": 10, "DUPLICATE_READING": 5, "IMPOSSIBLE_READING": 15, "METER_NOT_ACTIVE": 10}


def compute_risk(customer):
    readings = MeterReading.objects.filter(customer=customer).exclude(status="REJECTED").order_by("-reading_date")[:8]
    score = 0
    for r in readings:
        for f in r.anomaly_flags or []:
            score += RISK_WEIGHTS.get(f, 5)
    score += 10 * MeterReplacement.objects.filter(customer=customer).count()
    score = min(100, score)
    level = "HIGH" if score >= 60 else "MEDIUM" if score >= 30 else "LOW"
    if customer.risk_score != score or customer.risk_level != level:
        customer.risk_score, customer.risk_level = score, level
        customer.save(update_fields=["risk_score", "risk_level"])
    return score, level
