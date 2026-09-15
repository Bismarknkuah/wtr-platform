from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.communities.urls")),
    path("api/", include("apps.customers.urls")),
    path("api/", include("apps.meters.urls")),
    path("api/", include("apps.tariffs.urls")),
    path("api/", include("apps.billing.urls")),
    path("api/", include("apps.payments.urls")),
    path("api/", include("apps.infrastructure.urls")),
    path("api/", include("apps.tickets.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.audit.urls")),
    path("api/", include("apps.approvals.urls")),
    path("api/", include("apps.documents.urls")),
    path("api/", include("apps.analytics.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
