from decimal import Decimal, ROUND_HALF_UP

def money(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def volume(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
