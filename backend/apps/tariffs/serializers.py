from rest_framework import serializers
from .models import ServiceCharge, TariffPlan, TariffTier


class TariffTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = TariffTier
        fields = ["id", "order", "from_m3", "to_m3", "rate_per_m3", "slab_amount"]


class TariffPlanSerializer(serializers.ModelSerializer):
    tiers = TariffTierSerializer(many=True, required=False)
    customers_count = serializers.IntegerField(source="customers.count", read_only=True)
    scope = serializers.SerializerMethodField()

    class Meta:
        model = TariffPlan
        fields = "__all__"

    def get_scope(self, obj):
        return "Community"

    def _write_tiers(self, plan, tiers):
        plan.tiers.all().delete()
        for i, t in enumerate(tiers, start=1):
            t.pop("id", None)
            t["order"] = t.get("order") or i
            TariffTier.objects.create(plan=plan, **t)

    def create(self, data):
        tiers = data.pop("tiers", [])
        plan = TariffPlan.objects.create(**data)
        self._write_tiers(plan, tiers)
        return plan

    def update(self, inst, data):
        tiers = data.pop("tiers", None)
        for k, v in data.items():
            setattr(inst, k, v)
        inst.save()
        if tiers is not None:
            self._write_tiers(inst, tiers)
        return inst


class ServiceChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCharge
        fields = "__all__"
        read_only_fields = ["community"]
