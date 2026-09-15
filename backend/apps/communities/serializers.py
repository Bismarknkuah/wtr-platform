from rest_framework import serializers
from .models import Community, CommunityRole, CommunitySettings, SubscriptionPlan, Town


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    communities_count = serializers.IntegerField(source="communities.count", read_only=True)
    class Meta:
        model = SubscriptionPlan
        fields = "__all__"


class CommunitySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunitySettings
        fields = "__all__"
        read_only_fields = ["community"]


class CommunitySerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source="admin.full_name", read_only=True, default=None)
    admin_email = serializers.CharField(source="admin.email", read_only=True, default=None)
    plan_name = serializers.CharField(source="subscription_plan.name", read_only=True, default=None)
    customers_total = serializers.SerializerMethodField()
    active_meters = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = "__all__"
        read_only_fields = ["code", "approved_at", "approved_by", "registration_date"]

    def get_customers_total(self, obj):
        return getattr(obj, "customers_total", None) if hasattr(obj, "customers_total") else obj.customers.count()

    def get_active_meters(self, obj):
        return obj.meters.filter(status="ACTIVE").count()


class TownSerializer(serializers.ModelSerializer):
    customers_count = serializers.IntegerField(source="customers.count", read_only=True)
    tickets_open = serializers.SerializerMethodField()

    class Meta:
        model = Town
        fields = "__all__"
        read_only_fields = ["community"]

    def get_tickets_open(self, obj):
        return obj.tickets.filter(status__in=["OPEN", "ASSIGNED", "IN_PROGRESS"]).count()


class CommunityRoleSerializer(serializers.ModelSerializer):
    users_count = serializers.IntegerField(source="users.count", read_only=True)

    class Meta:
        model = CommunityRole
        fields = "__all__"
        read_only_fields = ["community"]

    def validate_modules(self, value):
        from core.modules import MODULE_INDEX
        bad = [k for k in value if k not in MODULE_INDEX]
        if bad:
            raise serializers.ValidationError(f"Unknown modules: {', '.join(bad)}")
        return sorted(set(value))
