from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.accounts.models import User
from apps.audit.services import log_action
from .models import Customer, Property
from .serializers import CustomerSerializer, PropertySerializer


class PropertyViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Property.objects.select_related("community")
    serializer_class = PropertySerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_CUSTOMERS", "retrieve": "VIEW_CUSTOMERS", "create": "CREATE_CUSTOMER", "update": "EDIT_CUSTOMER", "partial_update": "EDIT_CUSTOMER", "destroy": "DELETE_CUSTOMER"}
    search_fields = ["property_id", "address", "landmark"]
    filterset_fields = ["property_type", "town"]


class CustomerViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.select_related("community", "property", "tariff_plan", "user").prefetch_related("meters")
    serializer_class = CustomerSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_CUSTOMERS", "retrieve": "VIEW_CUSTOMERS", "create": "CREATE_CUSTOMER", "update": "EDIT_CUSTOMER",
                      "partial_update": "EDIT_CUSTOMER", "destroy": "DELETE_CUSTOMER", "create_portal_login": "EDIT_CUSTOMER",
                      "statement": ["VIEW_BILLS", "VIEW_CUSTOMERS"], "summary": "VIEW_CUSTOMERS"}
    filterset_fields = ["category", "account_status", "tariff_plan", "risk_level", "property", "town"]
    search_fields = ["customer_id", "household_name", "contact_person", "phone", "address"]
    ordering_fields = ["household_name", "outstanding_balance", "connection_date", "risk_score", "created_at"]

    def perform_destroy(self, instance):
        # Customers are never hard-deleted (financial history). Deactivation goes through the approval workflow.
        from rest_framework.exceptions import PermissionDenied, PermissionDenied
        raise PermissionDenied("Customers cannot be deleted. Submit a 'Customer deactivation' approval request instead.")

    @action(detail=True, methods=["post"])
    def create_portal_login(self, request, pk=None):
        c = self.get_object()
        email = (request.data.get("email") or c.email or "").strip().lower()
        password = request.data.get("password")
        if not email:
            return Response({"detail": "An email address is required for the portal login."}, status=400)
        if not password or len(password) < 8:
            return Response({"detail": "Provide a password of at least 8 characters."}, status=400)
        with transaction.atomic():
            if c.user:
                u = c.user
                u.set_password(password)
                u.save()
            else:
                if User.objects.filter(email__iexact=email).exists():
                    return Response({"detail": "A user with this email already exists."}, status=409)
                u = User.objects.create_user(email=email, password=password, full_name=c.contact_person or c.household_name,
                                             phone=c.phone, role=Role.CUSTOMER, community=c.community)
                c.user = u
                c.email = c.email or email
                c.save(update_fields=["user", "email"])
        log_action("PORTAL_LOGIN_CREATED", c, model_name="Customer")
        return Response({"detail": "Portal login ready.", "email": u.email})

    @action(detail=True, methods=["get"])
    def statement(self, request, pk=None):
        from apps.payments.models import LedgerEntry
        from apps.payments.serializers import LedgerEntrySerializer
        c = self.get_object()
        entries = LedgerEntry.objects.filter(customer=c).order_by("-created_at")[:200]
        return Response({"customer": CustomerSerializer(c).data, "entries": LedgerEntrySerializer(entries, many=True).data})

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        from apps.billing.models import Bill
        from apps.billing.serializers import BillSerializer
        from apps.meters.models import MeterReading
        from apps.meters.serializers import MeterReadingSerializer
        from apps.payments.models import Payment
        from apps.payments.serializers import PaymentSerializer
        c = self.get_object()
        return Response({
            "customer": CustomerSerializer(c).data,
            "recent_bills": BillSerializer(Bill.objects.filter(customer=c).order_by("-issued_at")[:6], many=True).data,
            "recent_payments": PaymentSerializer(Payment.objects.filter(customer=c).order_by("-created_at")[:6], many=True).data,
            "readings": MeterReadingSerializer(MeterReading.objects.filter(customer=c).order_by("-reading_date")[:12], many=True).data,
        })



# ------------------------------------------------------------------------------------------
# Front-desk account lookup: meter number / customer ID / phone → what the household owes
# ------------------------------------------------------------------------------------------
from rest_framework.permissions import IsAuthenticated  # noqa: E402
from rest_framework.views import APIView  # noqa: E402
from rest_framework.exceptions import PermissionDenied, ValidationError  # noqa: E402
from django.db.models import Q, Sum  # noqa: E402
from core.permissions import user_has  # noqa: E402
from core.roles import Role  # noqa: E402


class AccountLookupView(APIView):
    """
    GET /api/customers/account-lookup/?q=<meter number | customer ID | phone | household name>

    Returns the account a cashier needs to take a payment: household, balance, every unpaid bill
    with its outstanding amount, and the last few payments. Community staff only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        if u.role in Role.PLATFORM_ROLES or not u.community_id:
            raise PermissionDenied("Community staff only.")
        if not (user_has(u, "RECORD_PAYMENT") or user_has(u, "VIEW_BILLS")):
            raise PermissionDenied("You need the payments or bills permission.")
        q = (request.query_params.get("q") or "").strip()
        if not q:
            raise ValidationError({"q": "Enter a meter number, customer ID or phone."})
        from apps.meters.models import Meter
        from apps.billing.models import Bill
        from apps.payments.models import Payment
        base = Customer.objects.filter(community_id=u.community_id)
        meter = Meter.objects.filter(community_id=u.community_id).filter(Q(serial_number__iexact=q) | Q(meter_id__iexact=q)).select_related("customer").first()
        matches = list(base.filter(pk=meter.customer_id)) if meter and meter.customer_id else list(
            base.filter(Q(customer_id__iexact=q) | Q(phone=q) | Q(phone__endswith=q[-9:]) | Q(household_name__icontains=q)).order_by("household_name")[:8]
        )
        if not matches:
            return Response({"detail": f"No account matches '{q}'. Check the meter number on the meter face or the customer ID on a bill."}, status=404)
        if len(matches) > 1:
            return Response({"multiple": [{"id": c.id, "customer_id": c.customer_id, "household": c.household_name, "phone": c.phone, "outstanding": float(c.outstanding_balance), "meter": (c.active_meter.serial_number if c.active_meter else None)} for c in matches]})
        c = matches[0]
        m = c.active_meter
        unpaid = Bill.objects.filter(customer=c, outstanding_amount__gt=0).exclude(status="CANCELLED").order_by("issued_at")
        recent = Payment.objects.filter(customer=c, status="SUCCESSFUL").order_by("-paid_at")[:5]
        today = timezone.localdate()
        return Response({
            "customer": {"id": c.id, "customer_id": c.customer_id, "household": c.household_name, "contact_person": c.contact_person, "phone": c.phone, "address": c.address,
                         "category": c.category, "account_status": c.account_status, "town": c.town.name if c.town_id else None, "risk_level": c.risk_level},
            "meter": {"id": m.id, "serial_number": m.serial_number, "meter_id": m.meter_id, "status": m.status, "current_reading": m.current_reading} if m else None,
            "outstanding": float(c.outstanding_balance),
            "credit": float(-c.outstanding_balance) if c.outstanding_balance < 0 else 0.0,
            "overdue": float(sum(b.outstanding_amount for b in unpaid if b.due_date and b.due_date < today)),
            "unpaid_bills": [
                {"id": b.id, "invoice_number": b.invoice_number, "period_name": b.period.name if b.period_id else "", "issued_at": b.issued_at, "due_date": b.due_date,
                 "total_amount": float(b.total_amount), "amount_paid": float(b.amount_paid), "outstanding_amount": float(b.outstanding_amount), "status": b.status,
                 "days_overdue": max(0, (today - b.due_date).days) if b.due_date else 0}
                for b in unpaid
            ],
            "recent_payments": [{"id": p.id, "reference": p.reference, "amount": float(p.amount), "method": p.method, "paid_at": p.paid_at} for p in recent],
            "disconnection_warning": c.account_status == "DISCONNECTED" or any(b.due_date and (today - b.due_date).days > 45 for b in unpaid),
        })
