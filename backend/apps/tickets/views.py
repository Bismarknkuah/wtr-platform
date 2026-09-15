from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.accounts.models import User
from apps.audit.services import log_action
from apps.notifications.services import notify
from .models import ServiceRequest, TicketComment
from .serializers import ServiceRequestSerializer, TicketCommentSerializer


class ServiceRequestViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = ServiceRequest.objects.select_related("customer", "assigned_to", "raised_by", "meter", "bill")
    serializer_class = ServiceRequestSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_TICKETS", "retrieve": "VIEW_TICKETS", "create": "CREATE_TICKET", "update": "MANAGE_TICKETS", "partial_update": "MANAGE_TICKETS",
                      "destroy": "MANAGE_TICKETS", "assign": "MANAGE_TICKETS", "transition": ["MANAGE_TICKETS", "CREATE_TICKET"], "comments": "VIEW_TICKETS",
                      "add_comment": ["VIEW_TICKETS"], "rate": "CREATE_TICKET"}
    filterset_fields = ["status", "category", "priority", "assigned_to", "customer", "town", "source"]
    search_fields = ["ticket_number", "title", "description", "customer__household_name", "customer__customer_id"]
    ordering_fields = ["created_at", "priority", "status"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return ServiceRequest.objects.filter(customer=c) if c else ServiceRequest.objects.none()
        qs = super().get_queryset()
        if u.role in (Role.TECHNICIAN, Role.METER_READER):
            return qs.filter(assigned_to=u) | qs.filter(raised_by=u)
        return qs

    def perform_create(self, serializer):
        u = self.request.user
        serializer.validated_data["raised_by"] = u
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            if not c:
                raise ValidationError("Your login is not linked to a customer account.")
            serializer.validated_data["customer"] = c
            serializer.validated_data["community"] = c.community
            obj = serializer.save()
            log_action("CREATE", obj, model_name="ServiceRequest")
        else:
            super().perform_create(serializer)
        t = serializer.instance
        if t.customer:
            notify("SERVICE_REQUEST_UPDATE", community=t.community, customer=t.customer, context={"ticket": t.ticket_number, "status": "received", "note": "We will get back to you shortly."})

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        t = self.get_object()
        tech = User.objects.filter(pk=request.data.get("assigned_to"), community=t.community, is_active=True).first()
        if not tech:
            raise ValidationError({"assigned_to": "Select a staff member from this community."})
        t.assigned_to = tech
        t.status = ServiceRequest.Status.ASSIGNED
        if request.data.get("priority"):
            t.priority = request.data["priority"]
        t.save()
        log_action("TICKET_ASSIGNED", t, model_name="ServiceRequest", changes={"assigned_to": tech.full_name})
        notify("TICKET_ASSIGNED", community=t.community, user=tech, context={"ticket": t.ticket_number, "category": t.get_category_display(), "priority": t.priority})
        return Response(ServiceRequestSerializer(t).data)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        t = self.get_object()
        new = request.data.get("status")
        u = request.user
        allowed = {"OPEN": ["ASSIGNED", "IN_PROGRESS", "CANCELLED"], "ASSIGNED": ["IN_PROGRESS", "RESOLVED", "OPEN", "CANCELLED"],
                   "IN_PROGRESS": ["RESOLVED", "ASSIGNED", "CANCELLED"], "RESOLVED": ["CLOSED", "IN_PROGRESS"], "CLOSED": [], "CANCELLED": []}
        if new not in allowed.get(t.status, []):
            raise ValidationError({"status": f"Cannot move from {t.status} to {new}."})
        if u.role == Role.CUSTOMER and new not in ("CLOSED", "IN_PROGRESS", "CANCELLED"):
            raise PermissionDenied("Customers can only confirm (close), reopen or cancel their tickets.")
        t.status = new
        if new == "RESOLVED":
            t.resolution = request.data.get("resolution", t.resolution)
            t.resolved_at = timezone.now()
        if new == "CLOSED":
            t.closed_at = timezone.now()
        t.save()
        log_action("TICKET_STATUS", t, model_name="ServiceRequest", changes={"status": new})
        if t.customer:
            notify("SERVICE_REQUEST_UPDATE", community=t.community, customer=t.customer, context={"ticket": t.ticket_number, "status": t.get_status_display().lower(), "note": t.resolution if new == "RESOLVED" else ""})
        return Response(ServiceRequestSerializer(t).data)

    @action(detail=True, methods=["get"])
    def comments(self, request, pk=None):
        t = self.get_object()
        qs = t.comments.select_related("author")
        if request.user.role == Role.CUSTOMER:
            qs = qs.filter(is_internal=False)
        return Response(TicketCommentSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def add_comment(self, request, pk=None):
        t = self.get_object()
        body = request.data.get("body", "").strip()
        if not body:
            raise ValidationError({"body": "Comment cannot be empty."})
        internal = bool(request.data.get("is_internal")) and request.user.role != Role.CUSTOMER
        c = TicketComment.objects.create(community=t.community, ticket=t, author=request.user, body=body, is_internal=internal)
        return Response(TicketCommentSerializer(c).data, status=201)

    @action(detail=True, methods=["post"])
    def rate(self, request, pk=None):
        t = self.get_object()
        if t.status not in ("RESOLVED", "CLOSED"):
            raise ValidationError("You can rate a ticket once it is resolved.")
        rating = int(request.data.get("rating", 0))
        if not 1 <= rating <= 5:
            raise ValidationError({"rating": "Rating must be 1–5."})
        t.satisfaction_rating = rating
        t.satisfaction_comment = request.data.get("comment", "")
        if t.status == "RESOLVED":
            t.status, t.closed_at = ServiceRequest.Status.CLOSED, timezone.now()
        t.save()
        return Response(ServiceRequestSerializer(t).data)
