from rest_framework import viewsets
from core.permissions import HasPermission
from core.tenancy import TenantQuerysetMixin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("community", "actor")
    serializer_class = AuditLogSerializer
    permission_classes = [HasPermission]
    required_permission = "VIEW_AUDIT_LOG"
    filterset_fields = ["action", "model_name", "actor"]
    search_fields = ["object_label", "actor_label", "reason", "model_name"]
    ordering = ["-created_at"]
