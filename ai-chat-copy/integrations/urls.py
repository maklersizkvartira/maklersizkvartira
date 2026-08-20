from django.urls import include, path
from rest_framework.routers import DefaultRouter

from integrations.views import InboundWebhookView, IntegrationConfigViewSet, IntegrationEventViewSet

router = DefaultRouter()
router.register("", IntegrationConfigViewSet, basename="integration-configs")
router.register("events", IntegrationEventViewSet, basename="integration-events")

urlpatterns = [
    path("", include(router.urls)),
    path("webhooks/inbound/", InboundWebhookView.as_view(), name="integrations-inbound-webhook"),
]
