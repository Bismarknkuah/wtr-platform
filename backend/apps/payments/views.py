import hashlib, hmac, json
from django.conf import settings as dj_settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from apps.customers.models import Customer
from .models import LedgerEntry, Payment, Receipt, Refund
from .serializers import LedgerEntrySerializer, PaymentSerializer, ReceiptSerializer, RefundSerializer
from .services import record_payment, refund_payment, reverse_payment, settle_payment


class PaymentViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("customer", "community", "bill", "recorded_by", "receipt")
    serializer_class = PaymentSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_PAYMENTS", "VIEW_OWN_ACCOUNT"], "retrieve": ["VIEW_PAYMENTS", "VIEW_OWN_ACCOUNT"], "create": "RECORD_PAYMENT",
                      "reverse": "REFUND_PAYMENT", "refund": "REFUND_PAYMENT", "initiate": ["VIEW_OWN_ACCOUNT", "RECORD_PAYMENT"],
                      "confirm": ["RECORD_PAYMENT", "VIEW_OWN_ACCOUNT"]}
    http_method_names = ["get", "post", "head", "options"]
    filterset_fields = ["status", "method", "customer", "bill"]
    search_fields = ["reference", "provider_reference", "customer__household_name", "customer__customer_id", "payer_phone"]
    ordering_fields = ["paid_at", "amount", "status"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return Payment.objects.filter(customer=c) if c else Payment.objects.none()
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        community = self.resolve_community(s)
        p = record_payment(community=community, customer=d["customer"], amount=d["amount"], method=d.get("method", "CASH"), recorded_by=request.user,
                           bill=d.get("bill"), provider=d.get("provider", ""), provider_reference=d.get("provider_reference", ""),
                           payer_phone=d.get("payer_phone", ""), payer_name=d.get("payer_name", ""), paid_at=d.get("paid_at"), notes=d.get("notes", ""))
        return Response(PaymentSerializer(p).data, status=201)

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        p = reverse_payment(self.get_object(), request.user, request.data.get("reason", "").strip() or "No reason given")
        return Response(PaymentSerializer(p).data)

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        p = self.get_object()
        if request.user.role not in (Role.COMMUNITY_ADMIN, *Role.PLATFORM_ROLES):
            raise PermissionDenied("Submit a refund approval request; only admins can refund directly.")
        r = refund_payment(p, request.data.get("amount"), request.data.get("reason", "").strip() or "No reason given", request.user)
        return Response(RefundSerializer(r).data, status=201)

    @action(detail=False, methods=["post"])
    def initiate(self, request):
        """Customer-portal online payment. Creates a PENDING payment; the gateway webhook (or manual confirm) settles it."""
        u = request.user
        if u.role == Role.CUSTOMER:
            customer = getattr(u, "customer_profile", None)
            if not customer:
                raise ValidationError("Your login is not linked to a customer account.")
            community = customer.community
        else:
            community = self.resolve_community()
            customer = Customer.objects.filter(pk=request.data.get("customer"), community=community).first()
            if not customer:
                raise ValidationError({"customer": "Unknown customer."})
        amount = request.data.get("amount") or customer.outstanding_balance
        p = record_payment(community=community, customer=customer, amount=amount, method=request.data.get("method", "MOBILE_MONEY"), recorded_by=u,
                           provider=request.data.get("provider", "Paystack"), payer_phone=request.data.get("phone", customer.phone), status=Payment.Status.PENDING)
        gateway = {"reference": p.reference, "amount": str(p.amount), "currency": "GHS", "email": customer.email or u.email,
                   "configured": bool(dj_settings.PAYSTACK_SECRET_KEY)}
        return Response({"payment": PaymentSerializer(p).data, "gateway": gateway}, status=201)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        p = self.get_object()
        if p.status != Payment.Status.PENDING:
            raise ValidationError("Only pending payments can be confirmed.")
        if request.user.role == Role.CUSTOMER and not dj_settings.PAYSTACK_SECRET_KEY:
            pass  # sandbox mode: allow the customer to confirm their own pending portal payment
        elif request.user.role == Role.CUSTOMER:
            raise PermissionDenied("Payment confirmation comes from the gateway.")
        p.provider_reference = request.data.get("provider_reference", p.provider_reference)
        settle_payment(p)
        return Response(PaymentSerializer(p).data)


class ReceiptViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Receipt.objects.select_related("payment", "customer")
    serializer_class = ReceiptSerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_PAYMENTS", "VIEW_OWN_ACCOUNT"], "retrieve": ["VIEW_PAYMENTS", "VIEW_OWN_ACCOUNT"]}
    search_fields = ["receipt_number", "payment__reference", "customer__household_name"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return Receipt.objects.filter(customer=c) if c else Receipt.objects.none()
        return super().get_queryset()


class LedgerViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = LedgerEntry.objects.select_related("customer")
    serializer_class = LedgerEntrySerializer
    permission_classes = [HasPermission]
    permission_map = {"list": ["VIEW_FINANCIAL_REPORT", "VIEW_PAYMENTS", "VIEW_OWN_ACCOUNT"], "retrieve": ["VIEW_FINANCIAL_REPORT", "VIEW_PAYMENTS", "VIEW_OWN_ACCOUNT"]}
    filterset_fields = ["customer", "entry_type"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return LedgerEntry.objects.filter(customer=c) if c else LedgerEntry.objects.none()
        return super().get_queryset()


class RefundViewSet(TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Refund.objects.select_related("payment", "customer")
    serializer_class = RefundSerializer
    permission_classes = [HasPermission]
    required_permission = "VIEW_PAYMENTS"


@csrf_exempt
def paystack_webhook(request):
    """Paystack charge.success webhook. Verifies the HMAC signature and settles the matching pending payment."""
    secret = dj_settings.PAYSTACK_SECRET_KEY
    if not secret:
        return HttpResponse(status=503)
    sig = request.headers.get("x-paystack-signature", "")
    computed = hmac.new(secret.encode(), request.body, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(sig, computed):
        return HttpResponse(status=401)
    event = json.loads(request.body or "{}")
    if event.get("event") == "charge.success":
        data = event.get("data", {})
        p = Payment.objects.filter(reference=data.get("reference"), status=Payment.Status.PENDING).first()
        if p:
            p.provider_reference = str(data.get("id", ""))
            p.paid_at = timezone.now()
            settle_payment(p)
    return HttpResponse(status=200)
