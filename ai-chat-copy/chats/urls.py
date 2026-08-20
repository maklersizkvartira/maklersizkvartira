from django.urls import include
from rest_framework.routers import DefaultRouter

from chats.views import ChatSessionViewSet

router = DefaultRouter()
router.register("sessions", ChatSessionViewSet, basename="chat-sessions")

urlpatterns = [*router.urls]
