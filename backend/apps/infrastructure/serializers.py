from rest_framework import serializers
from .models import Asset, Emergency, MaintenanceRecord, Outage, WaterQualityTest


class AssetSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default=None)
    maintenance_due_in_days = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = "__all__"
        read_only_fields = ["asset_id", "community"]

    def get_maintenance_due_in_days(self, obj):
        from django.utils import timezone
        return (obj.next_maintenance - timezone.localdate()).days if obj.next_maintenance else None


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_code = serializers.CharField(source="asset.asset_id", read_only=True)
    technician_label = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceRecord
        fields = "__all__"
        read_only_fields = ["community"]

    def get_technician_label(self, obj):
        return obj.technician.full_name if obj.technician else obj.technician_name


class OutageSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True, default=None)
    declared_by_name = serializers.CharField(source="declared_by.full_name", read_only=True, default=None)

    class Meta:
        model = Outage
        fields = "__all__"
        read_only_fields = ["community", "declared_by", "customers_notified", "restored_at", "status"]


class WaterQualityTestSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True, default=None)
    issues = serializers.SerializerMethodField()

    class Meta:
        model = WaterQualityTest
        fields = "__all__"
        read_only_fields = ["community", "compliance_status", "tested_by"]

    def get_issues(self, obj):
        return obj.evaluate()


class EmergencySerializer(serializers.ModelSerializer):
    declared_by_name = serializers.CharField(source="declared_by.full_name", read_only=True, default=None)

    class Meta:
        model = Emergency
        fields = "__all__"
        read_only_fields = ["community", "declared_by", "declared_at", "resolved_at"]
