from rest_framework import serializers
from .models import Meter, MeterReading, MeterReplacement, ReadingRoute


class MeterSerializer(serializers.ModelSerializer):
    """`serial_number` is the number printed on the meter — the one a reader keys in. It is mandatory and unique."""
    serial_number = serializers.CharField(required=True, allow_blank=False, max_length=80, trim_whitespace=True,
                                          error_messages={"blank": "The meter number is required.", "required": "The meter number is required."})
    customer_name = serializers.CharField(source="customer.household_name", read_only=True, default=None)
    customer_code = serializers.CharField(source="customer.customer_id", read_only=True, default=None)
    property_label = serializers.CharField(source="property.__str__", read_only=True, default=None)
    replaced_by_id = serializers.CharField(source="replaced_by.meter_id", read_only=True, default=None)

    class Meta:
        model = Meter
        fields = "__all__"
        read_only_fields = ["meter_id", "community", "current_reading", "replaced_by"]

    def validate_serial_number(self, value):
        value = value.strip().upper()
        qs = Meter.objects.filter(serial_number__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A meter with this number is already registered.")
        return value


class MeterReplacementSerializer(serializers.ModelSerializer):
    old_meter_code = serializers.CharField(source="old_meter.meter_id", read_only=True)
    new_meter_code = serializers.CharField(source="new_meter.meter_id", read_only=True)
    customer_name = serializers.CharField(source="customer.household_name", read_only=True, default=None)

    class Meta:
        model = MeterReplacement
        fields = "__all__"
        read_only_fields = ["community", "performed_by"]


class MeterReadingSerializer(serializers.ModelSerializer):
    meter_code = serializers.CharField(source="meter.meter_id", read_only=True)
    customer_name = serializers.CharField(source="customer.household_name", read_only=True, default=None)
    customer_code = serializers.CharField(source="customer.customer_id", read_only=True, default=None)
    read_by_name = serializers.CharField(source="read_by.full_name", read_only=True, default=None)

    class Meta:
        model = MeterReading
        fields = "__all__"
        read_only_fields = ["community", "customer", "previous_reading", "consumption", "read_by", "status", "is_anomalous",
                            "anomaly_flags", "anomaly_note", "gps_distance_m", "validated_by", "validated_at"]


class BulkReadingItemSerializer(serializers.Serializer):
    meter = serializers.IntegerField()
    reading_value = serializers.DecimalField(max_digits=12, decimal_places=3)
    reading_date = serializers.DateField(required=False)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    photo_url = serializers.URLField(required=False, allow_blank=True)
    photo_base64 = serializers.CharField(required=False, allow_blank=True, help_text="Optional data-URL (image/jpeg;base64,…) captured on the phone")
    device_id = serializers.CharField(required=False, allow_blank=True)
    client_reading_id = serializers.CharField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    ocr_detected_value = serializers.DecimalField(max_digits=12, decimal_places=3, required=False, allow_null=True)


class ReadingRouteSerializer(serializers.ModelSerializer):
    reader_name = serializers.CharField(source="reader.full_name", read_only=True, default=None)
    customers_count = serializers.IntegerField(source="customers.count", read_only=True)

    class Meta:
        model = ReadingRoute
        fields = "__all__"
        read_only_fields = ["community"]
