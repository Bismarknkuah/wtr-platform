from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import LedgerViewSet, PaymentViewSet, ReceiptViewSet, RefundViewSet, paystack_webhook
router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("ledger", LedgerViewSet, basename="ledger")
router.register("refunds", RefundViewSet, basename="refund")
urlpatterns = [path("webhooks/paystack/", paystack_webhook)] + router.urls
