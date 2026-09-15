from rest_framework import serializers
from .models import Customer, Property


class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = "__all__"
        read_only_fields = ["property_id", "community"]


class CustomerSerializer(serializers.ModelSerializer):
    town_name = serializers.CharField(source="town.name", read_only=True, default=None)
    community_name = serializers.CharField(source="community.name", read_only=True)
    property_label = serializers.CharField(source="property.__str__", read_only=True, default=None)
    tariff_plan_name = serializers.CharField(source="tariff_plan.name", read_only=True, default=None)
    meter = serializers.SerializerMethodField()
    portal_email = serializers.CharField(source="user.email", read_only=True, default=None)

    class Meta:
        model = Customer
        fields = "__all__"
        read_only_fields = ["customer_id", "community", "outstanding_balance", "risk_score", "risk_level", "user"]

    def get_meter(self, obj):
        m = obj.active_meter
        return {"id": m.id, "meter_id": m.meter_id, "status": m.status, "current_reading": str(m.current_reading)} if m else None

    def validate_property(self, prop):
        request = self.context.get("request")
        if prop and request and request.user.community_id and prop.community_id != request.user.community_id:
            raise serializers.ValidationError("Property belongs to another community.")
        return prop
