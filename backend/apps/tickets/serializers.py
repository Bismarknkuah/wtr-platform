from rest_framework import serializers
from .models import ServiceRequest, TicketComment


class TicketCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True, default=None)
    class Meta:
        model = TicketComment
        fields = "__all__"
        read_only_fields = ["community", "ticket", "author"]


class ServiceRequestSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.household_name", read_only=True, default=None)
    customer_code = serializers.CharField(source="customer.customer_id", read_only=True, default=None)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True, default=None)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default=None)
    raised_by_name = serializers.CharField(source="raised_by.full_name", read_only=True, default=None)
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    town_name = serializers.CharField(source="town.name", read_only=True, default=None)

    class Meta:
        model = ServiceRequest
        fields = "__all__"
        read_only_fields = ["ticket_number", "community", "raised_by", "resolved_at", "closed_at", "satisfaction_rating", "satisfaction_comment"]
