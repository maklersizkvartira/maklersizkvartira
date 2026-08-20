from django.urls import include, path
from rest_framework.routers import DefaultRouter

from clients.views import ClientStatusViewSet, ClientViewSet

router = DefaultRouter()
router.register("statuses", ClientStatusViewSet, basename="client-statuses")

client_list = ClientViewSet.as_view({"get": "list", "post": "create"})
client_detail = ClientViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("", client_list, name="clients-list"),
    path("<uuid:pk>/", client_detail, name="clients-detail"),
    path("", include(router.urls)),
]
