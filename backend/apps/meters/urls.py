from rest_framework.routers import DefaultRouter
from .views import MeterReadingViewSet, MeterReplacementViewSet, MeterViewSet, ReadingRouteViewSet
router = DefaultRouter()
router.register("meters", MeterViewSet, basename="meter")
router.register("readings", MeterReadingViewSet, basename="reading")
router.register("routes", ReadingRouteViewSet, basename="route")
router.register("meter-replacements", MeterReplacementViewSet, basename="meter-replacement")
urlpatterns = router.urls
