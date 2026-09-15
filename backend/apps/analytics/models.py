from django.db import models
from core.models import TenantModel


class WaterProduction(TenantModel):
    """Daily volume produced/pumped into the network. Billed consumption vs production = non-revenue water (water loss)."""
    date = models.DateField()
    asset = models.ForeignKey("infrastructure.Asset", null=True, blank=True, on_delete=models.SET_NULL, related_name="production_logs")
    volume_m3 = models.DecimalField(max_digits=12, decimal_places=3)
    pump_hours = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date"]
        unique_together = [("community", "date", "asset")]
