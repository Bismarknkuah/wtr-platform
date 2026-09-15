from rest_framework.permissions import BasePermission
from core.roles import effective_permissions, Role


def user_has(user, perm: str) -> bool:
    return bool(user and user.is_authenticated and perm in effective_permissions(user))


AUTHENTICATED = "__authenticated__"


class HasPermission(BasePermission):
    """
    Views declare `permission_map = {"list": "VIEW_X", "create": "MANAGE_X", ...}`
    or `required_permission = "VIEW_X"` for all actions. Missing action → denied.
    The special value AUTHENTICATED allows any signed-in user (for "my own stuff" endpoints).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        action = getattr(view, "action", None) or request.method.lower()
        pmap = getattr(view, "permission_map", None)
        if pmap:
            perm = pmap.get(action) or pmap.get("*")
        else:
            perm = getattr(view, "required_permission", None)
        if perm is None:
            return False
        if perm == AUTHENTICATED:
            return True
        if isinstance(perm, (list, tuple, set)):
            return any(user_has(request.user, p) for p in perm)
        return user_has(request.user, perm)


class IsPlatformStaff(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in Role.PLATFORM_ROLES


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.CUSTOMER
