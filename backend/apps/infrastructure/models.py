from django.conf import settings
from django.db import models
from core.models import TenantModel


class Asset(TenantModel):
    class Type(models.TextChoices):
        BOREHOLE = "BOREHOLE", "Borehole"
        WELL = "WELL", "Well"
        TREATMENT_PLANT = "TREATMENT_PLANT", "Treatment plant"
        RESERVOIR = "RESERVOIR", "Reservoir"
        TANK = "TANK", "Tank"
        PIPELINE = "PIPELINE", "Pipeline"
        PUMP = "PUMP", "Pump"
        GENERATOR = "GENERATOR", "Generator"
        SOLAR = "SOLAR", "Solar system"
        CONTROL_PANEL = "CONTROL_PANEL", "Control panel"
        VALVE = "VALVE", "Valve"
        FILTER = "FILTER", "Filter"
        CHLORINATION = "CHLORINATION", "Chlorination equipment"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        OPERATIONAL = "OPERATIONAL", "Operational"
        DEGRADED = "DEGRADED", "Degraded"
        UNDER_MAINTENANCE = "UNDER_MAINTENANCE", "Under maintenance"
        FAILED = "FAILED", "Failed"
        DECOMMISSIONED = "DECOMMISSIONED", "Decommissioned"

    asset_id = models.CharField(max_length=20, unique=True, editable=False)
    name = models.CharField(max_length=120)
    asset_type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPERATIONAL)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children", help_text="Upstream asset in the network (source → treatment → reservoir → pipeline)")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    capacity = models.CharField(max_length=80, blank=True, help_text="e.g. 50 m³, 5 kW, 3 L/s")
    manufacturer = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    installed_on = models.DateField(null=True, blank=True)
    warranty_expiry = models.DateField(null=True, blank=True)
    maintenance_interval_days = models.PositiveIntegerField(default=90)
    last_maintenance = models.DateField(null=True, blank=True)
    next_maintenance = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["asset_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.asset_id})"

    def save(self, *args, **kwargs):
        if not self.asset_id:
            from core.ids import asset_id
            self.asset_id = asset_id(self.asset_type)
        super().save(*args, **kwargs)


class MaintenanceRecord(TenantModel):
    class Type(models.TextChoices):
        PREVENTIVE = "PREVENTIVE", "Preventive"
        CORRECTIVE = "CORRECTIVE", "Corrective (repair)"
        INSPECTION = "INSPECTION", "Inspection"

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="maintenance_records")
    maintenance_type = models.CharField(max_length=12, choices=Type.choices, default=Type.PREVENTIVE)
    performed_on = models.DateField()
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="maintenance_done")
    technician_name = models.CharField(max_length=120, blank=True)
    description = models.TextField()
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    parts_used = models.TextField(blank=True)
    downtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    was_failure = models.BooleanField(default=False)
    failure_cause = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-performed_on"]


class Outage(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        RESTORED = "RESTORED", "Restored"
        CANCELLED = "CANCELLED", "Cancelled"

    cause = models.CharField(max_length=200)
    affected_area = models.CharField(max_length=200, blank=True)
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="outages")
    started_at = models.DateTimeField()
    expected_restoration = models.DateTimeField(null=True, blank=True)
    restored_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    declared_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    notify_customers = models.BooleanField(default=True)
    customers_notified = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]


class WaterQualityTest(TenantModel):
    class Compliance(models.TextChoices):
        COMPLIANT = "COMPLIANT", "Compliant"
        ALERT = "ALERT", "Alert – investigation required"
        NON_COMPLIANT = "NON_COMPLIANT", "Non-compliant"

    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="quality_tests")
    testing_location = models.CharField(max_length=150)
    tested_on = models.DateField()
    laboratory = models.CharField(max_length=150, blank=True)
    ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    turbidity_ntu = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    chlorine_mg_l = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    tds_mg_l = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    temperature_c = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ecoli_cfu = models.IntegerField(null=True, blank=True, help_text="E. coli CFU/100 ml (0 = absent)")
    coliform_cfu = models.IntegerField(null=True, blank=True)
    result_summary = models.TextField(blank=True)
    compliance_status = models.CharField(max_length=15, choices=Compliance.choices, default=Compliance.COMPLIANT)
    tested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-tested_on"]

    def evaluate(self):
        """Ghana Standards Authority / WHO guideline checks."""
        issues = []
        if self.ph is not None and not (6.5 <= float(self.ph) <= 8.5):
            issues.append(f"pH {self.ph} outside 6.5–8.5")
        if self.turbidity_ntu is not None and float(self.turbidity_ntu) > 5:
            issues.append(f"Turbidity {self.turbidity_ntu} NTU > 5")
        if self.chlorine_mg_l is not None and not (0.2 <= float(self.chlorine_mg_l) <= 5.0):
            issues.append(f"Residual chlorine {self.chlorine_mg_l} mg/L outside 0.2–5.0")
        if self.tds_mg_l is not None and float(self.tds_mg_l) > 1000:
            issues.append(f"TDS {self.tds_mg_l} mg/L > 1000")
        if self.ecoli_cfu:
            issues.append(f"E. coli detected ({self.ecoli_cfu} CFU/100 ml)")
        if self.coliform_cfu:
            issues.append(f"Total coliforms detected ({self.coliform_cfu} CFU/100 ml)")
        if self.ecoli_cfu:
            self.compliance_status = self.Compliance.NON_COMPLIANT
        elif issues:
            self.compliance_status = self.Compliance.ALERT
        else:
            self.compliance_status = self.Compliance.COMPLIANT
        return issues


class Emergency(TenantModel):
    class Type(models.TextChoices):
        PIPELINE_BURST = "PIPELINE_BURST", "Major pipeline burst"
        PUMP_FAILURE = "PUMP_FAILURE", "Pump failure"
        CONTAMINATION = "CONTAMINATION", "Contamination"
        SHORTAGE = "SHORTAGE", "Severe water shortage"
        FLOODING = "FLOODING", "Flooding"
        INFRASTRUCTURE_DAMAGE = "INFRASTRUCTURE_DAMAGE", "Infrastructure damage"
        OTHER = "OTHER", "Other"

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        RESPONDING = "RESPONDING", "Responding"
        RESOLVED = "RESOLVED", "Resolved"

    emergency_type = models.CharField(max_length=25, choices=Type.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.HIGH)
    title = models.CharField(max_length=150)
    description = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    declared_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    declared_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    response_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-declared_at"]
        verbose_name_plural = "emergencies"
