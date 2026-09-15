from django.conf import settings
from django.db import models
from core.models import TenantModel


class Meter(TenantModel):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available (in stock)"
        INSTALLED = "INSTALLED", "Installed (not yet active)"
        ACTIVE = "ACTIVE", "Active"
        FAULTY = "FAULTY", "Faulty"
        BLOCKED = "BLOCKED", "Blocked"
        REMOVED = "REMOVED", "Removed"
        REPLACED = "REPLACED", "Replaced"
        RETIRED = "RETIRED", "Retired"

    class Condition(models.TextChoices):
        GOOD = "GOOD", "Good"
        FAIR = "FAIR", "Fair"
        POOR = "POOR", "Poor"
        DAMAGED = "DAMAGED", "Damaged"

    meter_id = models.CharField(max_length=20, unique=True, editable=False)
    serial_number = models.CharField(max_length=80, unique=True)
    meter_type = models.CharField(max_length=60, default="Mechanical")
    meter_size = models.CharField(max_length=30, blank=True, help_text='e.g. 15mm, 1/2"')
    manufacturer = models.CharField(max_length=100, blank=True)
    installation_date = models.DateField(null=True, blank=True)
    installation_location = models.CharField(max_length=200, blank=True)
    initial_reading = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    current_reading = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.AVAILABLE)
    condition = models.CharField(max_length=10, choices=Condition.choices, default=Condition.GOOD)
    customer = models.ForeignKey("customers.Customer", null=True, blank=True, on_delete=models.SET_NULL, related_name="meters")
    property = models.ForeignKey("customers.Property", null=True, blank=True, on_delete=models.SET_NULL, related_name="meters")
    last_inspection = models.DateField(null=True, blank=True)
    last_maintenance = models.DateField(null=True, blank=True)
    replaced_by = models.OneToOneField("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replaces")
    is_smart = models.BooleanField(default=False)
    iot_device_id = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["meter_id"]

    def __str__(self):
        return f"{self.meter_id} ({self.serial_number})"

    def save(self, *args, **kwargs):
        if not self.meter_id:
            from core.ids import meter_id
            self.meter_id = meter_id()
        if self.pk is None and self.current_reading == 0:
            self.current_reading = self.initial_reading
        super().save(*args, **kwargs)


class MeterReplacement(TenantModel):
    old_meter = models.ForeignKey(Meter, on_delete=models.PROTECT, related_name="replacements_out")
    new_meter = models.ForeignKey(Meter, on_delete=models.PROTECT, related_name="replacements_in")
    customer = models.ForeignKey("customers.Customer", null=True, on_delete=models.SET_NULL, related_name="meter_replacements")
    final_reading = models.DecimalField(max_digits=12, decimal_places=3)
    initial_reading = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.TextField()
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    performed_on = models.DateField()

    class Meta:
        ordering = ["-performed_on"]

    def __str__(self):
        return f"{self.old_meter.meter_id} → {self.new_meter.meter_id}" + (f" for {self.customer.household_name}" if self.customer_id else "")


class ReadingRoute(TenantModel):
    name = models.CharField(max_length=100)
    reader = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reading_routes")
    customers = models.ManyToManyField("customers.Customer", blank=True, related_name="routes")
    schedule_note = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class MeterReading(TenantModel):
    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Manual (office)"
        MOBILE = "MOBILE", "Mobile app"
        OCR = "OCR", "Photo OCR"
        IOT = "IOT", "Smart meter"
        ESTIMATED = "ESTIMATED", "Estimated"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending validation"
        VALIDATED = "VALIDATED", "Validated"
        REJECTED = "REJECTED", "Rejected"
        BILLED = "BILLED", "Billed"

    meter = models.ForeignKey(Meter, on_delete=models.PROTECT, related_name="readings")
    customer = models.ForeignKey("customers.Customer", null=True, on_delete=models.SET_NULL, related_name="readings")
    reading_value = models.DecimalField(max_digits=12, decimal_places=3)
    previous_reading = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    consumption = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reading_date = models.DateField()
    read_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="readings_taken")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_distance_m = models.PositiveIntegerField(null=True, blank=True, help_text="Distance between reader GPS and customer GPS")
    photo = models.ImageField(upload_to="readings/%Y/%m/", null=True, blank=True)
    photo_url = models.URLField(blank=True)
    device_id = models.CharField(max_length=120, blank=True)
    client_reading_id = models.CharField(max_length=80, blank=True, null=True, unique=True, help_text="Client-generated UUID for offline sync idempotency")
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    is_anomalous = models.BooleanField(default=False)
    anomaly_flags = models.JSONField(default=list, blank=True)
    anomaly_note = models.CharField(max_length=300, blank=True)
    ocr_detected_value = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    validated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    validated_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-reading_date", "-id"]
        indexes = [models.Index(fields=["meter", "reading_date"]), models.Index(fields=["community", "status"])]

    def __str__(self):
        return f"{self.meter.meter_id} · {self.reading_value} m³ on {self.reading_date}"
