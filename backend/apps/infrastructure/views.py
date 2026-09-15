from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import HasPermission
from core.tenancy import TenantQuerysetMixin
from apps.audit.services import log_action
from apps.notifications.services import notify, notify_community
from .models import Asset, Emergency, MaintenanceRecord, Outage, WaterQualityTest
from .serializers import AssetSerializer, EmergencySerializer, MaintenanceRecordSerializer, OutageSerializer, WaterQualityTestSerializer


class AssetViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Asset.objects.select_related("parent")
    serializer_class = AssetSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_INFRASTRUCTURE", "retrieve": "VIEW_INFRASTRUCTURE", "network": "VIEW_INFRASTRUCTURE", "due": "VIEW_INFRASTRUCTURE", "*": "MANAGE_INFRASTRUCTURE"}
    filterset_fields = ["asset_type", "status", "parent"]
    search_fields = ["name", "asset_id", "serial_number", "manufacturer"]

    @action(detail=False, methods=["get"])
    def network(self, request):
        """Tree of the water network (source → treatment → reservoir → pipeline → …) for the GIS / network view."""
        assets = list(self.get_queryset())
        by_parent = {}
        for a in assets:
            by_parent.setdefault(a.parent_id, []).append(a)
        def build(pid):
            return [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "type": a.asset_type, "status": a.status,
                     "latitude": a.latitude, "longitude": a.longitude, "children": build(a.id)} for a in by_parent.get(pid, [])]
        return Response(build(None))

    @action(detail=False, methods=["get"])
    def due(self, request):
        soon = timezone.localdate() + timedelta(days=int(request.query_params.get("days", 14)))
        qs = self.get_queryset().filter(next_maintenance__lte=soon).exclude(status="DECOMMISSIONED").order_by("next_maintenance")
        return Response(AssetSerializer(qs, many=True).data)


class MaintenanceRecordViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("asset", "technician")
    serializer_class = MaintenanceRecordSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_INFRASTRUCTURE", "retrieve": "VIEW_INFRASTRUCTURE", "*": "RECORD_MAINTENANCE"}
    filterset_fields = ["asset", "maintenance_type", "was_failure"]
    search_fields = ["description", "asset__name", "technician_name"]

    def perform_create(self, serializer):
        if not serializer.validated_data.get("technician") and self.request.user.role == "TECHNICIAN":
            serializer.validated_data["technician"] = self.request.user
        super().perform_create(serializer)
        rec = serializer.instance
        a = rec.asset
        a.last_maintenance = rec.performed_on
        a.next_maintenance = rec.performed_on + timedelta(days=a.maintenance_interval_days or 90)
        if a.status == Asset.Status.UNDER_MAINTENANCE or (rec.was_failure is False and a.status == Asset.Status.FAILED):
            a.status = Asset.Status.OPERATIONAL
        a.save(update_fields=["last_maintenance", "next_maintenance", "status", "updated_at"])


class OutageViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Outage.objects.select_related("asset", "declared_by")
    serializer_class = OutageSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_INFRASTRUCTURE", "VIEW_OWN_ACCOUNT", "VIEW_COMMUNITY_DASHBOARD"], "retrieve": ["VIEW_INFRASTRUCTURE", "VIEW_OWN_ACCOUNT"], "*": "MANAGE_OUTAGES"}
    filterset_fields = ["status", "asset"]

    def get_queryset(self):
        u = self.request.user
        if u.role == "CUSTOMER":
            return Outage.objects.filter(community_id=u.community_id)
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.validated_data["declared_by"] = self.request.user
        super().perform_create(serializer)
        o = serializer.instance
        if o.notify_customers:
            o.customers_notified = notify_community("WATER_OUTAGE", o.community, {"cause": o.cause, "area": o.affected_area,
                                                    "expected": o.expected_restoration.strftime("%d %b %H:%M") if o.expected_restoration else "to be confirmed"})
            o.save(update_fields=["customers_notified"])

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        o = self.get_object()
        o.status = Outage.Status.RESTORED
        o.restored_at = timezone.now()
        o.save(update_fields=["status", "restored_at"])
        log_action("OUTAGE_RESTORED", o, model_name="Outage")
        if o.notify_customers:
            notify_community("WATER_RESTORED", o.community, {"area": o.affected_area})
        return Response(OutageSerializer(o).data)


class WaterQualityTestViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = WaterQualityTest.objects.select_related("asset")
    serializer_class = WaterQualityTestSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_INFRASTRUCTURE", "VIEW_OWN_ACCOUNT"], "retrieve": ["VIEW_INFRASTRUCTURE", "VIEW_OWN_ACCOUNT"], "*": "MANAGE_WATER_QUALITY"}
    filterset_fields = ["compliance_status", "asset"]

    def get_queryset(self):
        u = self.request.user
        if u.role == "CUSTOMER":
            return WaterQualityTest.objects.filter(community_id=u.community_id)
        return super().get_queryset()

    def _finalize(self, serializer):
        obj = serializer.instance
        issues = obj.evaluate()
        obj.tested_by = obj.tested_by or self.request.user
        obj.save(update_fields=["compliance_status", "tested_by"])
        if obj.compliance_status != WaterQualityTest.Compliance.COMPLIANT:
            notify_community("WATER_QUALITY_ALERT", obj.community, {"location": obj.testing_location, "issues": "; ".join(issues)}, staff_only=True)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._finalize(serializer)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._finalize(serializer)


class EmergencyViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Emergency.objects.select_related("declared_by")
    serializer_class = EmergencySerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_INFRASTRUCTURE", "VIEW_COMMUNITY_DASHBOARD", "VIEW_PLATFORM_DASHBOARD"], "retrieve": ["VIEW_INFRASTRUCTURE", "VIEW_COMMUNITY_DASHBOARD"], "*": "MANAGE_EMERGENCIES"}
    filterset_fields = ["status", "severity", "emergency_type"]

    def perform_create(self, serializer):
        serializer.validated_data["declared_by"] = self.request.user
        super().perform_create(serializer)
        e = serializer.instance
        notify_community("EMERGENCY", e.community, {"title": e.title, "severity": e.severity, "type": e.get_emergency_type_display()})

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        e = self.get_object()
        e.status = Emergency.Status.RESOLVED
        e.resolved_at = timezone.now()
        e.response_notes = request.data.get("response_notes", e.response_notes)
        e.save()
        log_action("EMERGENCY_RESOLVED", e, model_name="Emergency")
        return Response(EmergencySerializer(e).data)
