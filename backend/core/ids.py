"""Sequential, human-readable identifiers (CUS-GAR-000125, INV-WTR-2026-000458, ...).
Uses a dedicated Sequence table with row locking so concurrent requests never collide."""
from django.db import transaction
from django.utils import timezone


def next_sequence(prefix: str, width: int = 6) -> str:
    from core.sequences import Sequence
    with transaction.atomic():
        seq, _ = Sequence.objects.select_for_update().get_or_create(prefix=prefix)
        seq.value += 1
        seq.save(update_fields=["value"])
        return f"{prefix}{seq.value:0{width}d}"


def community_code(region: str) -> str:
    part = "".join(ch for ch in (region or "GEN").upper() if ch.isalpha())[:3] or "GEN"
    return next_sequence(f"WTR-GH-{part}-", 3)


def customer_id(community_code_str: str) -> str:
    parts = community_code_str.split("-")
    part = parts[2] if len(parts) >= 3 else community_code_str[:3].upper()
    return next_sequence(f"CUS-{part}-")


def property_id() -> str:
    return next_sequence("PROP-")


def meter_id() -> str:
    return next_sequence("MTR-")


def asset_id(asset_type: str) -> str:
    return next_sequence(f"{asset_type[:4].upper()}-", 4)


def ticket_number() -> str:
    return next_sequence("WTR-")


def invoice_number() -> str:
    return next_sequence(f"INV-WTR-{timezone.now().year}-")


def payment_reference() -> str:
    return next_sequence(f"PAY-WTR-{timezone.now():%Y%m%d}-")


def receipt_number() -> str:
    return next_sequence(f"RCT-WTR-{timezone.now():%Y%m%d}-")
