from rest_framework import viewsets

from clients.models import Client, ClientStatus
from clients.permissions import ClientPermission
from clients.serializers import ClientSerializer, ClientStatusSerializer
from common.audit import log_model_event, snapshot_instance
from common.models import AuditLog


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.select_related("status").order_by("-updated_at")
    serializer_class = ClientSerializer
    permission_classes = [ClientPermission]
    search_fields = ("full_name", "phone", "interested_product", "notes")
    ordering_fields = ("updated_at", "created_at", "full_name")

    def perform_create(self, serializer):
        instance = serializer.save()
        log_model_event(actor=self.request.user, action=AuditLog.Action.CREATE, instance=instance)

    def perform_update(self, serializer):
        before = snapshot_instance(self.get_object())
        instance = serializer.save()
        log_model_event(actor=self.request.user, action=AuditLog.Action.UPDATE, instance=instance, before_data=before)

    def perform_destroy(self, instance):
        before = snapshot_instance(instance)
        log_model_event(actor=self.request.user, action=AuditLog.Action.DELETE, instance=instance, before_data=before)
        instance.delete()


class ClientStatusViewSet(viewsets.ModelViewSet):
    queryset = ClientStatus.objects.order_by("sort_order", "name")
    serializer_class = ClientStatusSerializer
    permission_classes = [ClientPermission]
    search_fields = ("name", "slug")
    ordering_fields = ("sort_order", "name", "created_at")

    def perform_create(self, serializer):
        instance = serializer.save()
        log_model_event(actor=self.request.user, action=AuditLog.Action.CREATE, instance=instance)

    def perform_update(self, serializer):
        before = snapshot_instance(self.get_object())
        instance = serializer.save()
        log_model_event(actor=self.request.user, action=AuditLog.Action.UPDATE, instance=instance, before_data=before)

    def perform_destroy(self, instance):
        before = snapshot_instance(instance)
        log_model_event(actor=self.request.user, action=AuditLog.Action.DELETE, instance=instance, before_data=before)
        instance.delete()
