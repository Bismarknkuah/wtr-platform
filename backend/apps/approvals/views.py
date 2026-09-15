from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.accounts.models import User
from apps.notifications.services import notify
from .models import ApprovalRequest
from .serializers import ApprovalRequestSerializer
from .services import decide, validate_payload


class ApprovalRequestViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = ApprovalRequest.objects.select_related("requested_by", "reviewed_by")
    serializer_class = ApprovalRequestSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_APPROVALS", "retrieve": "VIEW_APPROVALS", "create": "REQUEST_APPROVAL", "approve": "APPROVE_REQUESTS", "reject": "APPROVE_REQUESTS",
                      "destroy": "APPROVE_REQUESTS"}
    http_method_names = ["get", "post", "delete", "head", "options"]
    filterset_fields = ["status", "request_type", "requested_by"]
    search_fields = ["target_label", "reason"]

    def perform_create(self, serializer):
        validate_payload(serializer.validated_data["request_type"], serializer.validated_data.get("payload", {}))
        serializer.validated_data["requested_by"] = self.request.user
        super().perform_create(serializer)
        req = serializer.instance
        for admin in User.objects.filter(community=req.community, role=Role.COMMUNITY_ADMIN, is_active=True):
            notify("APPROVAL_REQUESTED", community=req.community, user=admin, context={"requester": self.request.user.full_name, "type": req.get_request_type_display(), "label": req.target_label})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return Response(ApprovalRequestSerializer(decide(self.get_object(), request.user, True, request.data.get("note", ""))).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return Response(ApprovalRequestSerializer(decide(self.get_object(), request.user, False, request.data.get("note", ""))).data)
