from rest_framework import status, viewsets
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from chats.services import enqueue_inbound_message
from chats.tasks import process_session_ai_task
from common.audit import log_model_event, snapshot_instance
from common.models import AuditLog
from integrations.models import IntegrationConfig, IntegrationEvent
from integrations.permissions import IntegrationPermission
from integrations.serializers import IntegrationConfigSerializer, IntegrationEventSerializer


class IntegrationConfigViewSet(viewsets.ModelViewSet):
    queryset = IntegrationConfig.objects.order_by("provider", "key")
    serializer_class = IntegrationConfigSerializer
    permission_classes = [IntegrationPermission]
    filterset_fields = ("provider", "is_active")
    search_fields = ("provider", "key", "description")
    ordering_fields = ("provider", "key", "updated_at", "created_at")

    def perform_create(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_model_event(actor=self.request.user, action=AuditLog.Action.CREATE, instance=instance)

    def perform_update(self, serializer):
        before = snapshot_instance(self.get_object())
        instance = serializer.save(updated_by=self.request.user)
        log_model_event(actor=self.request.user, action=AuditLog.Action.UPDATE, instance=instance, before_data=before)


class IntegrationEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IntegrationEvent.objects.order_by("-created_at")
    serializer_class = IntegrationEventSerializer
    permission_classes = [IntegrationPermission]
    filterset_fields = ("platform", "processed")
    search_fields = ("platform", "external_id", "event_type")
    ordering_fields = ("created_at", "updated_at")


class InboundWebhookSerializer(IntegrationEventSerializer):
    pass


class InboundWebhookView(GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.data or {}
        platform = str(payload.get("platform") or "").strip().lower()
        platform_user_id = str(payload.get("platform_user_id") or "").strip()
        message = str(payload.get("message") or "").strip()
        title = str(payload.get("title") or "").strip()
        raw_payload = payload.get("raw_payload") or payload
        if not platform or not platform_user_id or not message:
            return Response(
                {"status": "error", "message": "platform, platform_user_id, and message are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = IntegrationEvent.objects.create(
            platform=platform,
            external_id=str(payload.get("external_id") or ""),
            event_type="message",
            payload=raw_payload,
        )
        session, incoming = enqueue_inbound_message(
            platform=platform,
            platform_user_id=platform_user_id,
            message=message,
            raw_payload=raw_payload,
            title=title,
        )
        process_session_ai_task.apply_async(args=[str(session.id)], countdown=5)
        event.processed = True
        event.save(update_fields=["processed", "updated_at"])
        return Response(
            {
                "status": "success",
                "data": {
                    "session_id": str(session.id),
                    "incoming_message_id": str(incoming.id),
                    "queued_ai_delay_seconds": 5,
                },
            },
            status=status.HTTP_202_ACCEPTED,
        )
