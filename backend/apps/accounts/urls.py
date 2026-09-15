from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ChangePasswordView, LoginView, MeView, RefreshView, RolesView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
urlpatterns = [
    path("login/", LoginView.as_view()),
    path("refresh/", RefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("change-password/", ChangePasswordView.as_view()),
    path("roles/", RolesView.as_view()),
] + router.urls
