from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/health/", include("common.urls")),
    path("api/dashboard/", include("common.dashboard_urls")),
    path("api/audit-logs/", include("common.audit_urls")),
    path("api/auth/", include("users.auth_urls")),
    path("api/users/", include("users.urls")),
    path("api/clients/", include("clients.urls")),
    path("api/chats/", include("chats.urls")),
    path("api/settings/integrations/", include("integrations.urls")),
    path("api/settings/ai/", include("ai.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
