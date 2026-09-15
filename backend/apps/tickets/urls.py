from rest_framework.routers import DefaultRouter
from .views import ServiceRequestViewSet
router = DefaultRouter()
router.register("tickets", ServiceRequestViewSet, basename="ticket")
urlpatterns = router.urls
