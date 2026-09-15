from rest_framework.routers import DefaultRouter
from .views import BillViewSet, BillingPeriodViewSet
router = DefaultRouter()
router.register("billing-periods", BillingPeriodViewSet, basename="billing-period")
router.register("bills", BillViewSet, basename="bill")
urlpatterns = router.urls
