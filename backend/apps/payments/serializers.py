from rest_framework import serializers
from .models import LedgerEntry, Payment, Receipt, Refund


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.household_name", read_only=True)
    customer_code = serializers.CharField(source="customer.customer_id", read_only=True)
    community_name = serializers.CharField(source="community.name", read_only=True)
    bill_invoice = serializers.CharField(source="bill.invoice_number", read_only=True, default=None)
    receipt_number = serializers.CharField(source="receipt.receipt_number", read_only=True, default=None)
    recorded_by_name = serializers.CharField(source="recorded_by.full_name", read_only=True, default=None)

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["reference", "community", "status", "recorded_by", "allocations"]
        extra_kwargs = {"paid_at": {"required": False}}


class ReceiptSerializer(serializers.ModelSerializer):
    payment_reference = serializers.CharField(source="payment.reference", read_only=True)
    amount = serializers.DecimalField(source="payment.amount", max_digits=12, decimal_places=2, read_only=True)
    customer_name = serializers.CharField(source="customer.household_name", read_only=True)

    class Meta:
        model = Receipt
        fields = "__all__"


class LedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerEntry
        fields = "__all__"


class RefundSerializer(serializers.ModelSerializer):
    payment_reference = serializers.CharField(source="payment.reference", read_only=True)
    customer_name = serializers.CharField(source="customer.household_name", read_only=True)

    class Meta:
        model = Refund
        fields = "__all__"
