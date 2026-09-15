from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, EmergencyViewSet, MaintenanceRecordViewSet, OutageViewSet, WaterQualityTestViewSet
router = DefaultRouter()
router.register("assets", AssetViewSet, basename="asset")
router.register("maintenance", MaintenanceRecordViewSet, basename="maintenance")
router.register("outages", OutageViewSet, basename="outage")
router.register("water-quality", WaterQualityTestViewSet, basename="water-quality")
router.register("emergencies", EmergencyViewSet, basename="emergency")
urlpatterns = router.urls
