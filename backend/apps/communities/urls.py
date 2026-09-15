from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CommunityRoleViewSet, CommunityViewSet, PublicReportLinkView, PublicReportView, SubscriptionPlanViewSet, TownViewSet
router = DefaultRouter()
router.register("communities", CommunityViewSet, basename="community")
router.register("plans", SubscriptionPlanViewSet, basename="plan")
router.register("towns", TownViewSet, basename="town")
router.register("community-roles", CommunityRoleViewSet, basename="community-role")
urlpatterns = [
    path("public-report-link/", PublicReportLinkView.as_view()),
    path("public/report/<str:token>/", PublicReportView.as_view()),
] + router.urls
