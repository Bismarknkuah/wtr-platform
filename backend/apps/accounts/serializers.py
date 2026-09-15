from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from core.roles import Role
from .models import User


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.ListField(read_only=True)
    community_name = serializers.CharField(source="community.name", read_only=True, default=None)
    community_code = serializers.CharField(source="community.code", read_only=True, default=None)
    customer_id = serializers.SerializerMethodField()
    community_flags = serializers.SerializerMethodField()
    custom_role_name = serializers.CharField(source="custom_role.name", read_only=True, default=None)
    role_label = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role", "community", "community_name", "community_code",
                  "is_active", "permissions", "customer_id", "community_flags", "custom_role", "custom_role_name", "role_label", "last_login", "date_joined"]
        read_only_fields = ["last_login", "date_joined"]

    def get_customer_id(self, obj):
        c = getattr(obj, "customer_profile", None)
        return c.id if c else None

    def get_community_flags(self, obj):
        """Community-wide feature switches set by the community admin (drives what the portal shows)."""
        if not obj.community_id:
            return {}
        try:
            s = obj.community.settings
        except Exception:
            return {}
        return {f: getattr(s, f) for f in ("customer_portal_enabled", "online_payments_enabled", "customer_requests_enabled", "show_usage_to_customers")}


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role", "community", "is_active", "password", "custom_role"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role not in Role.PLATFORM_ROLES:
            attrs["community"] = request.user.community   # community staff can only create users in their own community
        role = attrs.get("role", getattr(self.instance, "role", None))
        community = attrs.get("community", getattr(self.instance, "community", None))
        if role in Role.COMMUNITY_STAFF_ROLES and community is None:
            raise serializers.ValidationError({"community": "Community staff must be attached to a community."})
        if role in Role.PLATFORM_ROLES:
            attrs["community"] = None
        return attrs

    def create(self, data):
        pwd = data.pop("password", None) or User.objects.make_random_password()
        user = User(**data)
        user.set_password(pwd)
        user.save()
        return user

    def update(self, instance, data):
        pwd = data.pop("password", None)
        for k, v in data.items():
            setattr(instance, k, v)
        if pwd:
            instance.set_password(pwd)
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
