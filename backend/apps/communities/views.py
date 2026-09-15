from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from core.permissions import HasPermission, user_has
from core.tenancy import TenantQuerysetMixin
from rest_framework.permissions import IsAuthenticated
from core.roles import Role
from apps.audit.services import log_action
from .models import Community, CommunityRole, CommunitySettings, SubscriptionPlan, Town
from .serializers import CommunityRoleSerializer, TownSerializer, CommunitySerializer, CommunitySettingsSerializer, SubscriptionPlanSerializer


class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_ALL_COMMUNITIES", "VIEW_COMMUNITY_DASHBOARD"], "retrieve": ["VIEW_ALL_COMMUNITIES", "VIEW_COMMUNITY_DASHBOARD"], "*": "MANAGE_PLANS"}


class CommunityViewSet(viewsets.ModelViewSet):
    queryset = Community.objects.select_related("admin", "subscription_plan")
    serializer_class = CommunitySerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_ALL_COMMUNITIES", "VIEW_COMMUNITY_DASHBOARD"], "retrieve": ["VIEW_ALL_COMMUNITIES", "VIEW_COMMUNITY_DASHBOARD"],
                      "policy": ["MANAGE_COMMUNITY_SETTINGS", "VIEW_COMMUNITY_DASHBOARD"], "features": ["MANAGE_COMMUNITY_SETTINGS"],
                      "approve": "APPROVE_COMMUNITIES", "suspend": "MANAGE_COMMUNITIES", "activate": "MANAGE_COMMUNITIES", "*": "MANAGE_COMMUNITIES"}
    filterset_fields = ["region", "district", "service_status", "water_system_type", "subscription_plan"]
    search_fields = ["name", "code", "region", "district", "town"]
    ordering_fields = ["name", "region", "registration_date", "service_status"]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if u.role in Role.PLATFORM_ROLES:
            return qs
        return qs.filter(pk=u.community_id) if u.community_id else qs.none()

    def perform_create(self, serializer):
        obj = serializer.save()
        log_action("CREATE", obj, model_name="Community", community=obj)

    def perform_update(self, serializer):
        obj = serializer.save()
        log_action("UPDATE", obj, model_name="Community", community=obj, changes={"fields": list(serializer.validated_data.keys())})

    def perform_destroy(self, instance):
        raise PermissionDenied("Communities are never deleted; deactivate them instead.")

    def _set_status(self, request, pk, new_status, action_name):
        c = self.get_object()
        old = c.service_status
        c.service_status = new_status
        if new_status == Community.Status.ACTIVE and not c.approved_at:
            c.approved_at = timezone.now()
            c.approved_by = request.user
        c.save()
        log_action(action_name, c, model_name="Community", community=c, changes={"service_status": {"from": old, "to": new_status}}, reason=request.data.get("reason", ""))
        return Response(CommunitySerializer(c).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._set_status(request, pk, Community.Status.ACTIVE, "APPROVE")

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._set_status(request, pk, Community.Status.SUSPENDED, "SUSPEND")

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return self._set_status(request, pk, Community.Status.ACTIVE, "ACTIVATE")

    @action(detail=True, methods=["get", "patch"], url_path="features")
    def features(self, request, pk=None):
        """
        System settings: which feature modules each role in this community may use, plus
        community-wide switches (customer portal, online payments…). Community admin only.
        """
        from core.modules import MODULES
        from core.roles import Role as R, permissions_for
        c = self.get_object()
        if request.user.role in Role.PLATFORM_ROLES:
            raise PermissionDenied("System settings are the community's own business.")
        s, _ = CommunitySettings.objects.get_or_create(community=c)
        if request.method == "PATCH":
            if request.user.role != Role.COMMUNITY_ADMIN:
                raise PermissionDenied("Only the community admin can change system settings.")
            access = request.data.get("module_access")
            if access is not None:
                if not isinstance(access, dict):
                    raise ValidationError({"module_access": "Expected {role: [module keys]}"})
                valid_keys = {m["key"] for m in MODULES}
                clean = {}
                for role, keys in access.items():
                    if role == R.COMMUNITY_ADMIN or role in R.PLATFORM_ROLES:
                        continue                       # the admin cannot lock themselves (or the platform) out
                    if role.startswith("custom:") and not c.custom_roles.filter(pk=role.split(":", 1)[1]).exists():
                        continue
                    clean[role] = sorted(k for k in (keys or []) if k in valid_keys)
                s.module_access = clean
            for flag in ("customer_portal_enabled", "online_payments_enabled", "customer_requests_enabled", "show_usage_to_customers"):
                if flag in request.data:
                    setattr(s, flag, bool(request.data[flag]))
            s.save()
            log_action("UPDATE", s, model_name="CommunitySettings", community=c, changes={"system_settings": "updated"}, reason=request.data.get("reason", ""))
        builtin = [R.COMMUNITY_FINANCE_OFFICER, R.COMMUNITY_WATER_MANAGER, R.METER_READER, R.TECHNICIAN, R.CUSTOMER_SUPPORT, R.FRONT_DESK_COLLECTOR, R.AUDITOR]
        roles = [{"key": r, "label": dict(R.CHOICES)[r], "builtin": True, "default_modules": [m["key"] for m in MODULES if set(m["perms"]) & permissions_for(r)]} for r in builtin]
        roles += [{"key": f"custom:{cr.id}", "label": cr.name, "builtin": False, "custom_role_id": cr.id, "description": cr.description, "default_modules": cr.modules, "users": cr.users.count()}
                  for cr in c.custom_roles.filter(is_active=True)]
        return Response({
            "modules": MODULES,
            "roles": roles,
            "module_access": s.module_access or {},
            "flags": {f: getattr(s, f) for f in ("customer_portal_enabled", "online_payments_enabled", "customer_requests_enabled", "show_usage_to_customers")},
        })

    @action(detail=True, methods=["get", "patch"], url_path="settings")
    def policy(self, request, pk=None):
        c = self.get_object()
        if request.user.role in Role.PLATFORM_ROLES:
            raise PermissionDenied("Billing policy and tariffs are set by the community's own officers, not by platform staff.")
        s, _ = CommunitySettings.objects.get_or_create(community=c)
        if request.method == "PATCH":
            if request.user.role != Role.COMMUNITY_ADMIN:
                raise PermissionDenied("Only the community admin can change policy settings.")
            ser = CommunitySettingsSerializer(s, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            log_action("UPDATE", s, model_name="CommunitySettings", community=c, changes={"fields": list(ser.validated_data.keys())})
            return Response(ser.data)
        return Response(CommunitySettingsSerializer(s).data)



class CommunityRoleViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    """
    Community-defined roles. The admin names the role, ticks the modules it may use, then assigns
    it to staff under Users & roles (role = CUSTOM + this role). Deactivating a role removes every
    permission from its users until they are reassigned.
    """
    queryset = CommunityRole.objects.select_related("community")
    serializer_class = CommunityRoleSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_USERS", "MANAGE_COMMUNITY_SETTINGS"], "retrieve": ["VIEW_USERS", "MANAGE_COMMUNITY_SETTINGS"], "*": "MANAGE_COMMUNITY_SETTINGS"}
    filterset_fields = ["is_active"]
    search_fields = ["name"]

    def perform_destroy(self, instance):
        if instance.users.exists():
            raise ValidationError({"detail": f"{instance.users.count()} user(s) still hold this role. Reassign them first, or deactivate the role instead."})
        super().perform_destroy(instance)


class TownViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    """Towns / villages / zones served by the community. Community staff only."""
    queryset = Town.objects.select_related("community")
    serializer_class = TownSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_COMMUNITY_DASHBOARD", "VIEW_CUSTOMERS", "VIEW_TICKETS"], "retrieve": ["VIEW_COMMUNITY_DASHBOARD", "VIEW_CUSTOMERS", "VIEW_TICKETS"],
                      "*": "MANAGE_COMMUNITY_SETTINGS"}
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]


# ------------------------------------------------------------------------------------------
# Public problem reporting (QR / link) — no account needed
# ------------------------------------------------------------------------------------------
from rest_framework.permissions import AllowAny  # noqa: E402
from rest_framework.throttling import AnonRateThrottle  # noqa: E402
from rest_framework.views import APIView  # noqa: E402
import secrets  # noqa: E402


class PublicReportThrottle(AnonRateThrottle):
    rate = "20/hour"


class PublicReportLinkView(APIView):
    """
    Water manager / admin: get (or regenerate) this community's public reporting link.
    GET  -> {token, url}
    POST -> regenerate (old QR posters stop working)
    """
    permission_classes = [IsAuthenticated]

    def _guard(self, request):
        u = request.user
        if u.role in Role.PLATFORM_ROLES or not u.community_id:
            raise PermissionDenied("Only community staff can manage the public reporting link.")
        if not user_has(u, "MANAGE_TICKETS") and not user_has(u, "MANAGE_OUTAGES") and u.role != Role.COMMUNITY_ADMIN:
            raise PermissionDenied("You need the service-requests or outages permission to manage the public link.")
        return u.community

    def _payload(self, c):
        from django.conf import settings as dj
        return {"token": c.public_report_token, "url": f"{dj.FRONTEND_URL.rstrip('/')}/report/{c.public_report_token}", "community": c.name,
                "towns": list(c.towns.filter(is_active=True).values("id", "name"))}

    def get(self, request):
        c = self._guard(request)
        if not c.public_report_token:
            c.public_report_token = secrets.token_urlsafe(18)[:24]
            c.save(update_fields=["public_report_token"])
        return Response(self._payload(c))

    def post(self, request):
        c = self._guard(request)
        c.public_report_token = secrets.token_urlsafe(18)[:24]
        c.save(update_fields=["public_report_token"])
        log_action("UPDATE", c, model_name="Community", community=c, changes={"public_report_token": "regenerated"}, reason="Public reporting link regenerated")
        return Response(self._payload(c))


class PublicReportView(APIView):
    """
    Anyone with the link: GET shows the community name and towns for the form; POST files a
    service request (source=PUBLIC). Throttled and validated; no personal data is exposed.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PublicReportThrottle]

    def _community(self, token):
        c = Community.objects.filter(public_report_token=token, service_status="ACTIVE").first() if token and len(token) >= 12 else None
        if not c:
            from django.http import Http404
            raise Http404("This reporting link is not valid.")
        return c

    def get(self, request, token):
        c = self._community(token)
        from apps.tickets.models import ServiceRequest
        return Response({
            "community": c.name, "region": c.region, "district": c.district, "contact_phone": c.contact_phone,
            "towns": list(c.towns.filter(is_active=True).order_by("name").values("id", "name")),
            "categories": [{"value": v, "label": l} for v, l in ServiceRequest.Category.choices if v in ("LEAK", "NO_WATER", "LOW_PRESSURE", "WATER_QUALITY", "METER_FAULT", "ILLEGAL_CONNECTION", "OTHER")],
        })

    def post(self, request, token):
        c = self._community(token)
        from apps.tickets.models import ServiceRequest
        from apps.customers.models import Customer
        d = request.data
        category = d.get("category") or "OTHER"
        if category not in dict(ServiceRequest.Category.choices):
            category = "OTHER"
        description = (d.get("description") or "").strip()
        if len(description) < 5:
            raise ValidationError({"description": "Please describe the problem (at least a few words)."})
        town = c.towns.filter(pk=d.get("town")).first() if d.get("town") else None
        phone = (d.get("reporter_phone") or "").strip()
        customer = Customer.objects.filter(community=c, phone=phone).first() if phone else None
        priority = "URGENT" if category in ("NO_WATER", "WATER_QUALITY") else "HIGH" if category in ("LEAK", "ILLEGAL_CONNECTION") else "MEDIUM"
        t = ServiceRequest.objects.create(
            community=c, customer=customer, category=category, priority=priority, source="PUBLIC",
            title=(d.get("title") or dict(ServiceRequest.Category.choices)[category])[:150], description=description,
            location=(d.get("location") or "")[:200], town=town,
            latitude=d.get("latitude") or None, longitude=d.get("longitude") or None,
            reporter_name=(d.get("reporter_name") or "")[:120], reporter_phone=phone[:30],
        )
        log_action("CREATE", t, model_name="ServiceRequest", community=c, reason="Public report via QR/link")
        from apps.notifications.services import notify_community
        try:
            notify_community("PUBLIC_REPORT", c, context={"ticket": t.ticket_number, "category": t.get_category_display(), "town": town.name if town else "—", "location": t.location}, staff_only=True)
        except Exception:
            pass
        return Response({"ticket_number": t.ticket_number, "message": "Thank you. Your report has been sent to the water office."}, status=201)
