from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from core.permissions import HasPermission
from core.roles import Role, ROLE_PERMISSIONS
from apps.audit.services import log_action
from .models import User
from .serializers import ChangePasswordSerializer, LoginSerializer, UserSerializer, UserWriteSerializer


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(email__iexact=request.data.get("email", ""))
            if user.role == Role.CUSTOMER and user.community_id:
                try:
                    if not user.community.settings.customer_portal_enabled:
                        return Response({"detail": "The customer portal is switched off for your community. Please contact the water office."}, status=status.HTTP_403_FORBIDDEN)
                except Exception:
                    pass
            log_action("LOGIN", user, model_name="User", community=user.community, actor=user)
        return response


class RefreshView(TokenRefreshView):
    pass


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        allowed = {k: v for k, v in request.data.items() if k in ("full_name", "phone")}
        for k, v in allowed.items():
            setattr(request.user, k, v)
        request.user.save(update_fields=list(allowed.keys()) or None)
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = ChangePasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if not request.user.check_password(s.validated_data["current_password"]):
            return Response({"detail": "Current password is incorrect."}, status=400)
        request.user.set_password(s.validated_data["new_password"])
        request.user.save()
        log_action("PASSWORD_CHANGE", request.user, model_name="User")
        return Response({"detail": "Password updated."})


class RolesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"roles": [{"value": v, "label": l} for v, l in Role.CHOICES],
                         "matrix": {r: sorted(p) for r, p in ROLE_PERMISSIONS.items()}})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("community")
    permission_classes = [HasPermission]
    permission_map = {"list": "VIEW_USERS", "retrieve": "VIEW_USERS", "*": "MANAGE_USERS"}
    filterset_fields = ["role", "community", "is_active"]
    search_fields = ["full_name", "email", "phone"]
    ordering_fields = ["full_name", "date_joined", "role"]

    def get_serializer_class(self):
        return UserWriteSerializer if self.action in ("create", "update", "partial_update") else UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in Role.PLATFORM_ROLES:
            # Platform staff manage platform accounts and hand a community over to its first admin.
            # Other community staff are the community admin's business.
            qs = qs.filter(Q(role__in=Role.PLATFORM_ROLES) | Q(role=Role.COMMUNITY_ADMIN))
            cid = self.request.query_params.get("community")
            return qs.filter(community_id=cid) if cid else qs
        return qs.filter(community_id=user.community_id).exclude(role__in=Role.PLATFORM_ROLES)

    def _guard(self, data, instance=None):
        user = self.request.user
        role = data.get("role", getattr(instance, "role", None))
        if user.role in Role.PLATFORM_ROLES:
            if role not in Role.PLATFORM_ROLES and role != Role.COMMUNITY_ADMIN:
                raise PermissionDenied("Platform staff may only create platform accounts and a community's admin. Community staff are created by that admin.")
            if role == Role.COMMUNITY_ADMIN and not data.get("community", getattr(instance, "community", None)):
                raise ValidationError({"community": "A community admin must be attached to a community."})
            return
        if role in Role.PLATFORM_ROLES:
            raise PermissionDenied("Community admins cannot create platform-level users.")
        data["community"] = user.community
        cr = data.get("custom_role", getattr(instance, "custom_role", None))
        if role == Role.CUSTOM:
            if cr is None:
                raise ValidationError({"custom_role": "Choose which custom role this user holds."})
            if cr.community_id != user.community_id:
                raise ValidationError({"custom_role": "That role belongs to another community."})
        elif "custom_role" in data:
            data["custom_role"] = None          # a built-in role never carries a custom-role link

    def perform_create(self, serializer):
        self._guard(serializer.validated_data)
        obj = serializer.save()
        log_action("CREATE", obj, model_name="User", community=obj.community)

    def perform_update(self, serializer):
        self._guard(serializer.validated_data, serializer.instance)
        obj = serializer.save()
        log_action("UPDATE", obj, model_name="User", community=obj.community, changes={"fields": list(serializer.validated_data.keys())})

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise PermissionDenied("You cannot delete your own account.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action("DEACTIVATE", instance, model_name="User", community=instance.community)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        pwd = request.data.get("password")
        if not pwd or len(pwd) < 8:
            return Response({"detail": "Provide a password of at least 8 characters."}, status=400)
        user.set_password(pwd)
        user.save()
        log_action("PASSWORD_RESET", user, model_name="User", community=user.community)
        return Response({"detail": "Password reset."}, status=status.HTTP_200_OK)
