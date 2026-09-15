"""Tariff engine: turns consumption (m³) into a water charge with a line-by-line breakdown."""
from decimal import Decimal
from core.utils import money, volume
from .models import ServiceCharge, TariffPlan


def compute_water_charge(plan: TariffPlan, consumption) -> tuple[Decimal, list]:
    c = max(volume(consumption), Decimal("0"))
    lines = []
    total = Decimal("0")
    if c == 0:
        pass
    elif plan.billing_mode == TariffPlan.Mode.FLAT:
        total = money(c * plan.flat_rate)
        lines.append({"description": f"Water consumption @ {plan.flat_rate}/m³", "quantity": str(c), "rate": str(plan.flat_rate), "amount": str(total)})
    elif plan.billing_mode == TariffPlan.Mode.SLAB:
        for t in plan.tiers.all():
            if c >= t.from_m3 and (t.to_m3 is None or c <= t.to_m3):
                total = money(t.slab_amount)
                lines.append({"description": f"Water consumption band {t.from_m3}–{t.to_m3 or '∞'} m³", "quantity": str(c), "rate": str(t.slab_amount), "amount": str(total)})
                break
        else:
            last = plan.tiers.order_by("-from_m3").first()
            if last:
                total = money(last.slab_amount)
                lines.append({"description": f"Water consumption (top band)", "quantity": str(c), "rate": str(last.slab_amount), "amount": str(total)})
    else:  # TIERED / incremental blocks
        remaining = c
        for t in plan.tiers.all():
            if remaining <= 0:
                break
            block = (t.to_m3 - t.from_m3) if t.to_m3 is not None else remaining
            used = min(remaining, block)
            amt = money(used * t.rate_per_m3)
            total += amt
            lines.append({"description": f"{'First' if t.from_m3 == 0 else 'Next'} {used} m³ @ {t.rate_per_m3}/m³", "quantity": str(used), "rate": str(t.rate_per_m3), "amount": str(amt)})
            remaining -= used
    if plan.minimum_charge and total < plan.minimum_charge:
        lines.append({"description": "Minimum charge top-up", "quantity": "1", "rate": str(plan.minimum_charge - total), "amount": str(money(plan.minimum_charge - total))})
        total = money(plan.minimum_charge)
    return money(total), lines


def fixed_charges_for(community, category) -> list:
    out = []
    for sc in ServiceCharge.objects.filter(community=community, is_active=True):
        if not sc.applies_to or category in sc.applies_to:
            out.append(sc)
    return out


def resolve_plan(customer) -> TariffPlan | None:
    if customer.tariff_plan and customer.tariff_plan.is_active:
        return customer.tariff_plan
    # Fall back to the community's own active plan for the category — never to another community's
    # or a platform-wide plan. Every community prices its own water.
    return (TariffPlan.objects.filter(community=customer.community, category=customer.category, is_active=True).first()
            or TariffPlan.objects.filter(community=customer.community, is_active=True).first())
