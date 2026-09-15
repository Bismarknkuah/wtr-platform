from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AccountLookupView, CustomerViewSet, PropertyViewSet
router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("properties", PropertyViewSet, basename="property")
urlpatterns = [path("customers/account-lookup/", AccountLookupView.as_view())] + router.urls
