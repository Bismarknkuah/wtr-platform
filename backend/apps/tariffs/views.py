from decimal import Decimal
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.audit.services import log_action
from .engine import compute_water_charge
from .models import ServiceCharge, TariffPlan
from .serializers import ServiceChargeSerializer, TariffPlanSerializer


class TariffPlanViewSet(viewsets.ModelViewSet):
    queryset = TariffPlan.objects.prefetch_related("tiers", "customers")
    serializer_class = TariffPlanSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_TARIFFS", "retrieve": "VIEW_TARIFFS", "simulate": "VIEW_TARIFFS", "*": "MANAGE_TARIFFS"}
    filterset_fields = ["category", "billing_mode", "is_active", "community"]
    search_fields = ["name", "description"]

    def get_queryset(self):
        """Tariffs belong to one community. Platform staff see none; community staff see only their own."""
        u = self.request.user
        if u.role in Role.PLATFORM_ROLES or not u.community_id:
            return super().get_queryset().none()
        return super().get_queryset().filter(community_id=u.community_id)

    def _scope(self, serializer):
        serializer.validated_data["community"] = self.request.user.community

    def perform_create(self, serializer):
        self._scope(serializer)
        obj = serializer.save()
        log_action("CREATE", obj, model_name="TariffPlan", community=obj.community)

    def perform_update(self, serializer):
        self._scope(serializer)
        obj = serializer.save()
        log_action("UPDATE", obj, model_name="TariffPlan", community=obj.community, changes={"fields": list(serializer.validated_data.keys())}, reason=self.request.data.get("reason", ""))

    def perform_destroy(self, instance):
        if instance.customers.exists():
            raise ValidationError("This tariff is assigned to customers. Deactivate it instead of deleting.")
        log_action("DELETE", instance, model_name="TariffPlan", community=instance.community)
        instance.delete()

    @action(detail=True, methods=["get"])
    def simulate(self, request, pk=None):
        plan = self.get_object()
        try:
            consumption = Decimal(str(request.query_params.get("consumption", "0")))
        except Exception:
            raise ValidationError({"consumption": "Provide a numeric consumption in m³."})
        total, lines = compute_water_charge(plan, consumption)
        return Response({"plan": plan.name, "consumption": str(consumption), "water_charge": str(total), "lines": lines})


class ServiceChargeViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = ServiceCharge.objects.all()
    serializer_class = ServiceChargeSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_TARIFFS", "retrieve": "VIEW_TARIFFS", "*": "MANAGE_TARIFFS"}
    filterset_fields = ["charge_type", "is_active"]
