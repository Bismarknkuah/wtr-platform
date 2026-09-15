from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from core.permissions import AUTHENTICATED, HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.customers.models import Customer
from .models import Notification
from .serializers import NotificationSerializer
from .services import notify, notify_community


class NotificationViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.select_related("customer", "user")
    serializer_class = NotificationSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_NOTIFICATIONS", "retrieve": "VIEW_NOTIFICATIONS", "mine": AUTHENTICATED, "mark_read": AUTHENTICATED,
                      "send": "SEND_NOTIFICATIONS", "broadcast": "SEND_NOTIFICATIONS"}
    filterset_fields = ["event", "channel", "status", "customer"]
    search_fields = ["title", "message", "recipient"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return Notification.objects.filter(Q(customer=c) | Q(user=u))
        return super().get_queryset()

    @action(detail=False, methods=["get"])
    def mine(self, request):
        u = request.user
        c = getattr(u, "customer_profile", None)
        qs = Notification.objects.filter(channel="PORTAL").filter(Q(user=u) | Q(customer=c) if c else Q(user=u)).order_by("-created_at")
        return Response({"unread": qs.filter(is_read=False).count(), "results": NotificationSerializer(qs[:50], many=True).data})

    @action(detail=False, methods=["post"])
    def mark_read(self, request):
        u = request.user
        c = getattr(u, "customer_profile", None)
        ids = request.data.get("ids")
        qs = Notification.objects.filter(channel="PORTAL").filter(Q(user=u) | Q(customer=c) if c else Q(user=u))
        if ids:
            qs = qs.filter(id__in=ids)
        return Response({"updated": qs.update(is_read=True)})

    @action(detail=False, methods=["post"])
    def send(self, request):
        community = self.resolve_community()
        customer = Customer.objects.filter(pk=request.data.get("customer"), community=community).first()
        if not customer:
            raise ValidationError({"customer": "Unknown customer."})
        msg = request.data.get("message", "").strip()
        if not msg:
            raise ValidationError({"message": "Message is required."})
        out = notify("CUSTOM", community=community, customer=customer, context={"message": msg}, channels=request.data.get("channels") or None)
        return Response({"sent": len(out)})

    @action(detail=False, methods=["post"])
    def broadcast(self, request):
        community = self.resolve_community()
        msg = request.data.get("message", "").strip()
        if not msg:
            raise ValidationError({"message": "Message is required."})
        n = notify_community("CUSTOM", community, {"message": msg}, staff_only=bool(request.data.get("staff_only")))
        return Response({"customers_notified": n})
