from rest_framework import serializers
from .models import Bill, BillAdjustment, BillingPeriod, DunningAction


class BillingPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingPeriod
        fields = "__all__"
        read_only_fields = ["community", "status", "generated_at", "generated_by", "bills_count", "total_billed"]

    def validate(self, a):
        s, e, d = a.get("start_date"), a.get("end_date"), a.get("due_date")
        if s and e and e < s:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        if e and d and d < e:
            raise serializers.ValidationError({"due_date": "Due date must be on or after the period end."})
        return a


class BillSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.household_name", read_only=True)
    customer_code = serializers.CharField(source="customer.customer_id", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    community_name = serializers.CharField(source="community.name", read_only=True)
    meter_code = serializers.CharField(source="meter.meter_id", read_only=True, default=None)
    period_name = serializers.CharField(source="period.name", read_only=True, default=None)

    class Meta:
        model = Bill
        fields = "__all__"
        read_only_fields = [f.name for f in Bill._meta.fields if f.name not in ("notes",)]


class BillAdjustmentSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source="approved_by.full_name", read_only=True, default=None)
    class Meta:
        model = BillAdjustment
        fields = "__all__"


class DunningActionSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.household_name", read_only=True)
    customer_code = serializers.CharField(source="customer.customer_id", read_only=True)
    class Meta:
        model = DunningAction
        fields = "__all__"
