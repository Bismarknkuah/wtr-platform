"""
Tenant isolation. Every tenant-scoped ViewSet mixes this in:
  - community roles are hard-scoped to their own community, regardless of query params
  - platform roles get NOTHING from tenant-scoped endpoints: they run the platform (community
    registry, plans, first admin accounts, aggregate benchmark) but a community's data belongs
    to that community's officers alone
  - customers are scoped to their own customer record (handled in the relevant views)
"""
from rest_framework.exceptions import PermissionDenied, ValidationError
from core.roles import Role
from apps.audit.services import log_action


class TenantQuerysetMixin:
    community_field = "community"

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in Role.PLATFORM_ROLES or user.community_id is None:
            return qs.none()
        return qs.filter(**{f"{self.community_field}_id": user.community_id})

    def resolve_community(self, serializer=None):
        user = self.request.user
        if user.role in Role.PLATFORM_ROLES:
            raise PermissionDenied("Platform staff cannot create records inside a community. Each community's officers manage their own data.")
        if not user.community_id:
            raise PermissionDenied("Your account is not attached to a community.")
        return user.community

    def perform_create(self, serializer):
        community = self.resolve_community(serializer)
        obj = serializer.save(community=community)
        log_action("CREATE", obj, changes={"created": serializer.validated_data.keys() and "record created"})

    def perform_update(self, serializer):
        before = {f: getattr(serializer.instance, f, None) for f in serializer.validated_data.keys()}
        obj = serializer.save()
        after = {f: getattr(obj, f, None) for f in before}
        changes = {k: {"from": str(before[k]), "to": str(after[k])} for k in before if str(before[k]) != str(after[k])}
        log_action("UPDATE", obj, changes=changes, reason=self.request.data.get("reason", ""))

    def perform_destroy(self, instance):
        log_action("DELETE", instance, reason=self.request.data.get("reason", "") if hasattr(self.request, "data") else "")
        instance.delete()
