from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from core.permissions import HasPermission
from core.roles import Role
from core.tenancy import TenantQuerysetMixin
from .models import Document
from .serializers import DocumentSerializer


class DocumentViewSet(TenantQuerysetMixin, viewsets.ModelViewSet):
    queryset = Document.objects.select_related("customer", "uploaded_by")
    serializer_class = DocumentSerializer
    permission_classes = [HasPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_map = {"list": ["VIEW_DOCUMENTS", "VIEW_OWN_ACCOUNT"], "retrieve": ["VIEW_DOCUMENTS", "VIEW_OWN_ACCOUNT"], "*": "MANAGE_DOCUMENTS"}
    filterset_fields = ["category", "customer", "asset"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            c = getattr(u, "customer_profile", None)
            return Document.objects.filter(customer=c, is_public_to_customer=True) if c else Document.objects.none()
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.validated_data["uploaded_by"] = self.request.user
        super().perform_create(serializer)
