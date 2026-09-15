from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (ActivityFeedView, AuditorDashboardView, BenchmarkView, CommunityDashboardView, CustomerPortalView, FinanceDashboardView, IntelligenceView,
                    MeterReaderDashboardView, OperationsDashboardView, PlatformDashboardView, RevenueReportView, ScoreView, SupportDashboardView,
                    TechnicianDashboardView, FrontDeskDashboardView, WaterProductionViewSet)
router = DefaultRouter()
router.register("water-production", WaterProductionViewSet, basename="water-production")
urlpatterns = [
    path("dashboard/platform/", PlatformDashboardView.as_view()),
    path("dashboard/community/", CommunityDashboardView.as_view()),
    path("dashboard/customer/", CustomerPortalView.as_view()),
    path("dashboard/finance/", FinanceDashboardView.as_view()),
    path("dashboard/operations/", OperationsDashboardView.as_view()),
    path("dashboard/meter-reader/", MeterReaderDashboardView.as_view()),
    path("dashboard/technician/", TechnicianDashboardView.as_view()),
    path("dashboard/support/", SupportDashboardView.as_view()),
    path("dashboard/auditor/", AuditorDashboardView.as_view()),
    path("dashboard/activity/", ActivityFeedView.as_view()),
    path("dashboard/front-desk/", FrontDeskDashboardView.as_view()),
    path("analytics/benchmark/", BenchmarkView.as_view()),
    path("analytics/score/", ScoreView.as_view()),
    path("analytics/revenue/", RevenueReportView.as_view()),
    path("analytics/intelligence/", IntelligenceView.as_view()),
] + router.urls
