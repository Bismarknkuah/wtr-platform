from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.audit.services import log_action
from apps.customers.models import Customer
from .models import Bill, BillAdjustment, BillingPeriod, DunningAction
from .serializers import BillAdjustmentSerializer, BillSerializer, BillingPeriodSerializer, DunningActionSerializer
from .services import generate_bill_for_customer, generate_bills_for_period, refresh_overdue, run_dunning


class BillingPeriodViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = BillingPeriod.objects.select_related("community")
    serializer_class = BillingPeriodSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_BILLS", "retrieve": "VIEW_BILLS", "generate": "CREATE_BILL", "close": "CREATE_BILL", "*": "CREATE_BILL"}
    filterset_fields = ["status", "frequency"]
    search_fields = ["name"]

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        period = self.get_object()
        summary = generate_bills_for_period(period, request.user)
        return Response({"period": BillingPeriodSerializer(period).data, "summary": summary})

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        period = self.get_object()
        period.status = BillingPeriod.Status.CLOSED
        period.save(update_fields=["status"])
        log_action("PERIOD_CLOSED", period, model_name="BillingPeriod")
        return Response(BillingPeriodSerializer(period).data)

    def perform_destroy(self, instance):
        if instance.bills.exists():
            raise ValidationError("Periods with bills cannot be deleted.")
        super().perform_destroy(instance)


class BillViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Bills are immutable financial records. They are created by the billing engine and changed only via adjustments."""
    queryset = Bill.objects.select_related("customer", "community", "meter", "period", "tariff_plan")
    serializer_class = BillSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_BILLS", "VIEW_OWN_ACCOUNT"], "retrieve": ["VIEW_BILLS", "VIEW_OWN_ACCOUNT"], "generate_single": "CREATE_BILL",
                      "adjust": "ADJUST_BILL", "cancel": "ADJUST_BILL", "refresh_overdue": "MANAGE_DEBT", "run_dunning": "MANAGE_DEBT",
                      "adjustments": "VIEW_BILLS", "aging": ["VIEW_FINANCIAL_REPORT", "MANAGE_DEBT"], "dunning_history": "MANAGE_DEBT"}
    filterset_fields = ["status", "customer", "period", "meter"]
    search_fields = ["invoice_number", "customer__household_name", "customer__customer_id", "customer__phone"]
    ordering_fields = ["issued_at", "due_date", "total_amount", "outstanding_amount", "status"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return Bill.objects.filter(customer=c) if c else Bill.objects.none()
        return super().get_queryset()

    @action(detail=False, methods=["post"])
    def generate_single(self, request):
        community = self.resolve_community()
        try:
            customer = Customer.objects.get(pk=request.data.get("customer"), community=community)
            period = BillingPeriod.objects.get(pk=request.data.get("period"), community=community)
        except (Customer.DoesNotExist, BillingPeriod.DoesNotExist, ValueError, TypeError):
            raise ValidationError("Provide a valid customer and billing period.")
        bill, outcome = generate_bill_for_customer(customer, period, request.user)
        if not bill:
            raise ValidationError({"detail": {"already_billed": "This customer already has a bill for the period.",
                                              "no_validated_reading": "No validated meter reading in this period.",
                                              "no_tariff": "No active tariff applies to this customer."}[outcome]})
        return Response(BillSerializer(bill).data, status=201)

    @action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        """Direct adjustment for admins. Officers must go through the approval workflow (BILL_ADJUSTMENT request)."""
        bill = self.get_object()
        if request.user.role not in (Role.COMMUNITY_ADMIN, *Role.PLATFORM_ROLES):
            raise PermissionDenied("Submit a bill adjustment approval request; only admins can adjust directly.")
        from .services import apply_adjustment
        amount, reason = request.data.get("amount"), request.data.get("reason", "").strip()
        if amount in (None, "") or not reason:
            raise ValidationError({"detail": "Amount and reason are required."})
        apply_adjustment(bill, amount, reason, request.user)
        bill.refresh_from_db()
        return Response(BillSerializer(bill).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        bill = self.get_object()
        if bill.amount_paid > 0:
            raise ValidationError("A bill with payments cannot be cancelled; adjust it instead.")
        from .services import apply_adjustment
        apply_adjustment(bill, -bill.outstanding_amount, f"Cancelled: {request.data.get('reason', 'no reason given')}", request.user)
        bill.status = Bill.Status.CANCELLED
        bill.save(update_fields=["status"])
        return Response(BillSerializer(bill).data)

    @action(detail=True, methods=["get"])
    def adjustments(self, request, pk=None):
        return Response(BillAdjustmentSerializer(self.get_object().adjustments.all(), many=True).data)

    @action(detail=False, methods=["post"])
    def refresh_overdue(self, request):
        community = self.resolve_community()
        return Response({"updated": refresh_overdue(community)})

    @action(detail=False, methods=["post"])
    def run_dunning(self, request):
        community = self.resolve_community()
        return Response({"actions": run_dunning(community, request.user)})

    @action(detail=False, methods=["get"])
    def dunning_history(self, request):
        community = self.resolve_community()
        qs = DunningAction.objects.filter(community=community).select_related("customer")[:200]
        return Response(DunningActionSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def aging(self, request):
        from django.utils import timezone
        community = self.resolve_community()
        refresh_overdue(community)
        today = timezone.localdate()
        buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
        for b in Bill.objects.filter(community=community, outstanding_amount__gt=0).exclude(status="CANCELLED"):
            d = (today - b.due_date).days
            k = "current" if d <= 0 else "1_30" if d <= 30 else "31_60" if d <= 60 else "61_90" if d <= 90 else "over_90"
            buckets[k] += float(b.outstanding_amount)
        top = Customer.objects.filter(community=community, outstanding_balance__gt=0).order_by("-outstanding_balance")[:20]
        return Response({"buckets": buckets, "top_debtors": [{"id": c.id, "customer_id": c.customer_id, "household": c.household_name, "phone": c.phone,
                                                              "outstanding": str(c.outstanding_balance), "status": c.account_status} for c in top]})
