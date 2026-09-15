from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.audit.services import log_action
from .models import Meter, MeterReading, MeterReplacement, ReadingRoute
from .serializers import (BulkReadingItemSerializer, MeterReadingSerializer, MeterReplacementSerializer, MeterSerializer, ReadingRouteSerializer)
from .services import record_reading, replace_meter, validate_reading


def _decode_photo(data_url, name_hint):
    """Turn an optional `data:image/jpeg;base64,…` string from the phone into a Django file, or None."""
    if not data_url:
        return None
    import base64
    from django.core.files.base import ContentFile
    try:
        header, payload = data_url.split(",", 1)
        ext = "png" if "png" in header else "jpg"
        return ContentFile(base64.b64decode(payload), name=f"meter-{name_hint}.{ext}")
    except Exception:
        return None


class MeterViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Meter.objects.select_related("community", "customer", "property", "replaced_by")
    serializer_class = MeterSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_METERS", "retrieve": "VIEW_METERS", "history": "VIEW_METERS", "lookup": ["VIEW_METERS", "RECORD_READING"], "*": "MANAGE_METERS"}
    filterset_fields = ["status", "condition", "customer", "property", "meter_type", "is_smart"]
    search_fields = ["meter_id", "serial_number", "manufacturer", "customer__household_name", "customer__customer_id"]
    ordering_fields = ["meter_id", "installation_date", "status", "current_reading"]

    def perform_create(self, serializer):
        data = serializer.validated_data
        if data.get("customer") and data.get("status") in (None, Meter.Status.AVAILABLE):
            data["status"] = Meter.Status.ACTIVE
        super().perform_create(serializer)

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """
        Find a meter by the number printed on it (serial number) or its system ID, within the caller's
        community. Returns everything a reader needs to key in a reading: household, previous reading,
        usual consumption, meter status. `?number=`.
        """
        number = (request.query_params.get("number") or "").strip()
        if not number:
            raise ValidationError({"number": "Enter the meter number."})
        meter = self.get_queryset().filter(serial_number__iexact=number).first() or self.get_queryset().filter(meter_id__iexact=number).first()
        if not meter:
            return Response({"detail": f"No meter numbered '{number}' in your community."}, status=404)
        from django.db.models import Avg
        last = MeterReading.objects.filter(meter=meter).exclude(status="REJECTED").order_by("-reading_date", "-id").first()
        avg = MeterReading.objects.filter(meter=meter, status__in=["VALIDATED", "BILLED"]).aggregate(a=Avg("consumption"))["a"]
        c = meter.customer
        return Response({
            "meter": meter.id, "meter_id": meter.meter_id, "serial_number": meter.serial_number, "meter_status": meter.status, "meter_type": meter.meter_type,
            "installation_location": meter.installation_location,
            "customer": c.id if c else None, "customer_id": c.customer_id if c else None, "household": c.household_name if c else None,
            "phone": c.phone if c else None, "address": c.address if c else "", "category": c.category if c else None,
            "latitude": c.latitude if c else None, "longitude": c.longitude if c else None,
            "previous_reading": str(last.reading_value if last else meter.initial_reading), "previous_date": last.reading_date if last else None,
            "avg_consumption": float(avg or 0), "last_status": last.status if last else None, "last_flags": last.anomaly_flags if last else [],
            "read_this_month": bool(last and last.reading_date.month == timezone.localdate().month and last.reading_date.year == timezone.localdate().year),
        })

    def perform_update(self, serializer):
        data = serializer.validated_data
        inst = serializer.instance
        if "customer" in data and data["customer"] and inst.customer_id is None and inst.status == Meter.Status.AVAILABLE:
            data["status"] = Meter.Status.ACTIVE
        super().perform_update(serializer)

    @action(detail=True, methods=["post"])
    def replace(self, request, pk=None):
        old = self.get_object()
        d = request.data
        try:
            new = Meter.objects.get(pk=d.get("new_meter"))
        except (Meter.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"new_meter": "Select the replacement meter."})
        for f in ("final_reading", "initial_reading", "reason"):
            if d.get(f) in (None, ""):
                raise ValidationError({f: "This field is required."})
        rep = replace_meter(community=old.community, old_meter=old, new_meter=new, final_reading=d["final_reading"],
                            initial_reading=d["initial_reading"], reason=d["reason"], performed_by=request.user, performed_on=d.get("performed_on") or None)
        return Response(MeterReplacementSerializer(rep).data, status=201)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        m = self.get_object()
        return Response({
            "meter": MeterSerializer(m).data,
            "readings": MeterReadingSerializer(m.readings.all()[:60], many=True).data,
            "replacements": MeterReplacementSerializer(MeterReplacement.objects.filter(old_meter=m) | MeterReplacement.objects.filter(new_meter=m), many=True).data,
        })


class MeterReadingViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = MeterReading.objects.select_related("meter", "customer", "read_by")
    serializer_class = MeterReadingSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_READINGS", "retrieve": "VIEW_READINGS", "create": "RECORD_READING", "bulk_sync": "RECORD_READING",
                      "validate": "VALIDATE_READING", "reject": "VALIDATE_READING", "anomalies": "VIEW_READINGS", "my_route": "RECORD_READING",
                      "update": "VALIDATE_READING", "partial_update": "VALIDATE_READING", "destroy": "VALIDATE_READING"}
    filterset_fields = ["meter", "customer", "status", "source", "is_anomalous", "read_by"]
    search_fields = ["meter__meter_id", "customer__household_name", "customer__customer_id"]
    ordering_fields = ["reading_date", "consumption", "reading_value", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == Role.METER_READER:
            return qs.filter(read_by=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        community = self.resolve_community(s)
        meter = d["meter"]
        auto = request.user.role in (Role.COMMUNITY_ADMIN, Role.COMMUNITY_WATER_MANAGER) or request.user.role in Role.PLATFORM_ROLES
        reading, created = record_reading(community=community, meter=meter, reading_value=d["reading_value"], reading_date=d.get("reading_date"),
                                          read_by=request.user, source=d.get("source", "MANUAL"), latitude=d.get("latitude"), longitude=d.get("longitude"),
                                          photo=d.get("photo"), photo_url=d.get("photo_url", ""), device_id=d.get("device_id", ""),
                                          client_reading_id=d.get("client_reading_id"), notes=d.get("notes", ""),
                                          ocr_detected_value=d.get("ocr_detected_value"), auto_validate=auto and not request.data.get("hold"))
        return Response(MeterReadingSerializer(reading).data, status=201 if created else 200)

    def perform_destroy(self, instance):
        if instance.status == "BILLED":
            raise ValidationError("Billed readings cannot be deleted. Use a bill adjustment.")
        super().perform_destroy(instance)

    @action(detail=False, methods=["post"])
    def bulk_sync(self, request):
        """Offline-first sync. Each item carries a client UUID; replays are idempotent, conflicts are reported not silently merged."""
        items = request.data.get("readings", [])
        community = self.resolve_community()
        results = []
        for raw in items:
            s = BulkReadingItemSerializer(data=raw)
            if not s.is_valid():
                results.append({"client_reading_id": raw.get("client_reading_id"), "status": "error", "errors": s.errors})
                continue
            d = s.validated_data
            meter = Meter.objects.filter(pk=d["meter"], community=community).first()
            if not meter:
                results.append({"client_reading_id": d["client_reading_id"], "status": "error", "errors": {"meter": "Unknown meter for this community."}})
                continue
            try:
                with transaction.atomic():
                    reading, created = record_reading(community=community, meter=meter, reading_value=d["reading_value"], reading_date=d.get("reading_date"),
                                                      read_by=request.user, source="MOBILE", latitude=d.get("latitude"), longitude=d.get("longitude"),
                                                      photo=_decode_photo(d.get("photo_base64"), d["client_reading_id"]), photo_url=d.get("photo_url", ""),
                                                      device_id=d.get("device_id", ""), client_reading_id=d["client_reading_id"],
                                                      notes=d.get("notes", ""), ocr_detected_value=d.get("ocr_detected_value"))
                results.append({"client_reading_id": d["client_reading_id"], "status": "created" if created else "duplicate", "id": reading.id,
                                "flags": reading.anomaly_flags, "consumption": str(reading.consumption)})
            except Exception as e:
                results.append({"client_reading_id": d["client_reading_id"], "status": "error", "errors": {"detail": str(e)}})
        log_action("READINGS_SYNCED", model_name="MeterReading", community=community, changes={"count": len(items)})
        return Response({"results": results})

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        r = validate_reading(self.get_object(), request.user, True, request.data.get("note", ""))
        return Response(MeterReadingSerializer(r).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        r = validate_reading(self.get_object(), request.user, False, request.data.get("note", ""))
        return Response(MeterReadingSerializer(r).data)

    @action(detail=False, methods=["get"])
    def anomalies(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(is_anomalous=True).exclude(status="REJECTED"))
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(MeterReadingSerializer(page, many=True).data)

    @action(detail=False, methods=["get"])
    def my_route(self, request):
        """Meter reader's assigned households with their meters and last readings (mobile app / reader dashboard)."""
        routes = ReadingRoute.objects.filter(reader=request.user, is_active=True).prefetch_related("customers__meters")
        out = []
        for route in routes:
            stops = []
            for c in route.customers.all():
                m = c.active_meter
                stops.append({"customer": c.id, "customer_id": c.customer_id, "household": c.household_name, "address": c.address,
                              "latitude": c.latitude, "longitude": c.longitude, "meter": m.id if m else None, "meter_id": m.meter_id if m else None,
                              "previous_reading": str(m.current_reading) if m else None, "phone": c.phone})
            out.append({"route": route.id, "name": route.name, "schedule_note": route.schedule_note, "stops": stops})
        return Response(out)


class ReadingRouteViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = ReadingRoute.objects.select_related("reader").prefetch_related("customers")
    serializer_class = ReadingRouteSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_READINGS", "retrieve": "VIEW_READINGS", "*": "MANAGE_METERS"}
    search_fields = ["name"]


class MeterReplacementViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MeterReplacement.objects.select_related("old_meter", "new_meter", "customer", "performed_by")
    serializer_class = MeterReplacementSerializer
    permission_classes = [HasPermission]
    required_permission = "VIEW_METERS"
