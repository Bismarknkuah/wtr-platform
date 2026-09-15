from rest_framework.routers import DefaultRouter
from .views import ServiceChargeViewSet, TariffPlanViewSet
router = DefaultRouter()
router.register("tariffs", TariffPlanViewSet, basename="tariff")
router.register("service-charges", ServiceChargeViewSet, basename="service-charge")
urlpatterns = router.urls
