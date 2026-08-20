from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.audit import log_model_event, snapshot_instance
from common.models import AuditLog
from ai.models import AISettings
from ai.permissions import AISettingsPermission
from ai.serializers import AISettingsSerializer


class AISettingsViewSet(viewsets.ModelViewSet):
    queryset = AISettings.objects.order_by("-updated_at")
    serializer_class = AISettingsSerializer
    permission_classes = [AISettingsPermission]
    search_fields = ("name", "model")
    ordering_fields = ("updated_at", "name", "model")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        log_model_event(actor=request.user, action=AuditLog.Action.CREATE, instance=obj)
        return Response({"status": "success", "data": self.get_serializer(obj).data}, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        before = snapshot_instance(obj)
        serializer = self.get_serializer(obj, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        log_model_event(actor=request.user, action=AuditLog.Action.UPDATE, instance=obj, before_data=before)
        return Response({"status": "success", "data": self.get_serializer(obj).data})

    @action(detail=False, methods=["get"])
    def active(self, request):
        queryset = AISettings.objects.filter(is_active=True).order_by("-updated_at")
        return Response({"status": "success", "data": self.get_serializer(queryset, many=True).data})
