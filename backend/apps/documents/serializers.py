from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name", read_only=True, default=None)
    customer_name = serializers.CharField(source="customer.household_name", read_only=True, default=None)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = ["community", "uploaded_by"]

    def get_url(self, obj):
        if obj.external_url:
            return obj.external_url
        if obj.file:
            req = self.context.get("request")
            return req.build_absolute_uri(obj.file.url) if req else obj.file.url
        return None
