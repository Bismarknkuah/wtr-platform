from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.household_name", read_only=True, default=None)
    class Meta:
        model = Notification
        fields = "__all__"
