from rest_framework.routers import DefaultRouter

from ai.views import AISettingsViewSet

router = DefaultRouter()
router.register("", AISettingsViewSet, basename="ai-settings")

urlpatterns = router.urls
