from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = "__all__"
