from datetime import date, timedelta
from django.conf import settings as dj_settings
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from core.permissions import HasPermission, user_has
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.communities.models import Community
from rest_framework import serializers
from .models import WaterProduction
from .services import benchmark, community_dashboard, intelligence, platform_dashboard, revenue_report, sustainability_score


class WaterProductionSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True, default=None)
    class Meta:
        model = WaterProduction
        fields = "__all__"
        read_only_fields = ["community"]


class WaterProductionViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = WaterProduction.objects.select_related("asset")
    serializer_class = WaterProductionSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_INFRASTRUCTURE", "retrieve": "VIEW_INFRASTRUCTURE", "*": "MANAGE_INFRASTRUCTURE"}
    filterset_fields = ["asset", "date"]


def _community_for(request):
    u = request.user
    if u.role in Role.PLATFORM_ROLES:
        raise PermissionDenied("Platform staff do not have access to community dashboards. Each community's officers manage their own operations.")
    if not u.community_id:
        raise PermissionDenied("Your account is not attached to a community.")
    return u.community


class PlatformDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if not user_has(request.user, "VIEW_PLATFORM_DASHBOARD"):
            raise PermissionDenied()
        return Response(platform_dashboard())


class CommunityDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if not user_has(request.user, "VIEW_COMMUNITY_DASHBOARD"):
            raise PermissionDenied()
        return Response(community_dashboard(_community_for(request)))


class BenchmarkView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if not user_has(request.user, "VIEW_ALL_COMMUNITIES"):
            raise PermissionDenied()
        return Response(benchmark())


class ScoreView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if not user_has(request.user, "VIEW_ANALYTICS"):
            raise PermissionDenied()
        return Response(sustainability_score(_community_for(request)))


class RevenueReportView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if not user_has(request.user, "VIEW_FINANCIAL_REPORT"):
            raise PermissionDenied()
        c = _community_for(request)
        try:
            start = date.fromisoformat(request.query_params.get("start")) if request.query_params.get("start") else timezone.localdate().replace(day=1)
            end = date.fromisoformat(request.query_params.get("end")) if request.query_params.get("end") else timezone.localdate() + timedelta(days=1)
        except ValueError:
            raise ValidationError("Dates must be YYYY-MM-DD.")
        return Response(revenue_report(c, start, end))


class IntelligenceView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        if not user_has(request.user, "VIEW_ANALYTICS"):
            raise PermissionDenied()
        u = request.user
        community = None if u.role in Role.PLATFORM_ROLES and not request.data.get("community") else \
            (Community.objects.get(pk=request.data["community"]) if u.role in Role.PLATFORM_ROLES else u.community)
        result = intelligence(request.data.get("question", ""), community)
        result["narrative"] = None
        if dj_settings.ANTHROPIC_API_KEY and request.data.get("narrate"):
            try:
                import json, urllib.request
                body = json.dumps({"model": "claude-sonnet-4-6", "max_tokens": 400, "messages": [{"role": "user", "content":
                        f"You are a water-utility analyst for Ghanaian community water systems. Question: {request.data.get('question')}\nData: {json.dumps(result['data'])[:6000]}\nWrite a 3-sentence plain-English insight with one recommended action."}]}).encode()
                req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={"x-api-key": dj_settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
                resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
                result["narrative"] = "".join(b.get("text", "") for b in resp.get("content", []))
            except Exception as e:  # pragma: no cover
                result["narrative"] = f"(AI narration unavailable: {e})"
        return Response(result)


class CustomerPortalView(APIView):
    """Everything the household dashboard needs in one call."""
    permission_classes = [IsAuthenticated]
    def get(self, request):
        c = getattr(request.user, "customer_profile", None)
        if not c:
            raise PermissionDenied("This account is not linked to a customer record.")
        from apps.billing.models import Bill, BillingPeriod
        from apps.billing.serializers import BillSerializer
        from apps.customers.serializers import CustomerSerializer
        from apps.infrastructure.models import Outage
        from apps.infrastructure.serializers import OutageSerializer
        from apps.meters.models import MeterReading
        from apps.meters.serializers import MeterReadingSerializer
        from apps.payments.models import Payment
        from apps.payments.serializers import PaymentSerializer
        from apps.tickets.models import ServiceRequest
        from apps.tickets.serializers import ServiceRequestSerializer
        latest_bill = Bill.objects.filter(customer=c).exclude(status="CANCELLED").order_by("-issued_at").first()
        last_pay = Payment.objects.filter(customer=c, status="SUCCESSFUL").order_by("-paid_at").first()
        last_reading = MeterReading.objects.filter(customer=c).exclude(status="REJECTED").order_by("-reading_date").first()
        next_period = BillingPeriod.objects.filter(community=c.community, status="OPEN").order_by("end_date").first()
        return Response({
            "customer": CustomerSerializer(c).data,
            "summary": {"current_consumption_m3": float(last_reading.consumption) if last_reading else 0, "current_bill": float(latest_bill.total_amount) if latest_bill else 0,
                        "current_bill_status": latest_bill.status if latest_bill else None, "outstanding": float(c.outstanding_balance),
                        "last_payment": float(last_pay.amount) if last_pay else 0, "last_payment_date": last_pay.paid_at if last_pay else None,
                        "next_billing_date": next_period.end_date if next_period else None, "due_date": latest_bill.due_date if latest_bill else None},
            "bills": BillSerializer(Bill.objects.filter(customer=c).order_by("-issued_at")[:12], many=True).data,
            "payments": PaymentSerializer(Payment.objects.filter(customer=c).order_by("-paid_at")[:12], many=True).data,
            "consumption": [{"date": str(r.reading_date), "reading": float(r.reading_value), "consumption": float(r.consumption)} for r in reversed(list(MeterReading.objects.filter(customer=c).exclude(status="REJECTED").order_by("-reading_date")[:12]))],
            "tickets": ServiceRequestSerializer(ServiceRequest.objects.filter(customer=c)[:10], many=True).data,
            "outages": OutageSerializer(Outage.objects.filter(community=c.community, status="ACTIVE"), many=True).data,
            "gateway_configured": bool(dj_settings.PAYSTACK_SECRET_KEY),
        })


# ------------------------------------------------------------------------------------------
# Role dashboards — one endpoint per role so each screen can evolve independently.
# ------------------------------------------------------------------------------------------
from .role_dashboards import (activity_feed, auditor_dashboard, finance_dashboard, front_desk_dashboard, meter_reader_dashboard,  # noqa: E402
                              operations_dashboard, support_dashboard, technician_dashboard)


def _require_any(user, *perms):
    if not any(user_has(user, p) for p in perms):
        raise PermissionDenied("You do not have access to this dashboard.")


class FinanceDashboardView(APIView):
    """Community Finance Officer: revenue, collections, debt, approvals."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "VIEW_FINANCIAL_REPORT", "VIEW_BILLS")
        return Response(finance_dashboard(_community_for(request)))


class OperationsDashboardView(APIView):
    """Community Water Manager / Platform Operations Admin: supply, meters, readings, infrastructure, quality."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "VIEW_INFRASTRUCTURE", "VIEW_METERS")
        return Response(operations_dashboard(_community_for(request)))


class MeterReaderDashboardView(APIView):
    """Meter reader: own routes, progress, recent readings. Always scoped to the signed-in reader."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "RECORD_READING")
        if not request.user.community_id:
            raise PermissionDenied("Your account is not attached to a community.")
        return Response(meter_reader_dashboard(request.user))


class TechnicianDashboardView(APIView):
    """Technician: own tickets, maintenance schedule, outages, faulty meters."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "RECORD_MAINTENANCE", "VIEW_INFRASTRUCTURE")
        if not request.user.community_id:
            raise PermissionDenied("Your account is not attached to a community.")
        return Response(technician_dashboard(request.user))


class SupportDashboardView(APIView):
    """Customer support: ticket queue, SLA, satisfaction, delivery health."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "VIEW_TICKETS", "MANAGE_TICKETS")
        return Response(support_dashboard(_community_for(request)))


class AuditorDashboardView(APIView):
    """Auditor: activity volumes, approvals, sensitive financial actions. Community optional for platform roles."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "VIEW_AUDIT_LOG")
        return Response(auditor_dashboard(_community_for(request)))


class ActivityFeedView(APIView):
    """Recent audit events, humanised. ?mine=1 restricts to the caller's own actions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        mine = request.query_params.get("mine") in ("1", "true")
        limit = min(int(request.query_params.get("limit", 20)), 100)
        if mine:
            return Response(activity_feed(None, limit=limit, user=u))
        if u.role in Role.PLATFORM_ROLES:
            _require_any(u, "VIEW_PLATFORM_DASHBOARD")
            return Response(activity_feed(None, limit=limit, platform_only=True))   # registry/plan/user events only
        _require_any(u, "VIEW_AUDIT_LOG", "VIEW_COMMUNITY_DASHBOARD")
        return Response(activity_feed(_community_for(request), limit=limit))


class FrontDeskDashboardView(APIView):
    """Front desk collector: my takings today / this week, my receipts, community collection pulse."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_any(request.user, "RECORD_PAYMENT")
        if request.user.role in Role.PLATFORM_ROLES or not request.user.community_id:
            raise PermissionDenied("Community staff only.")
        return Response(front_desk_dashboard(request.user))
