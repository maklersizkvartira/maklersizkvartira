from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from chats.models import ChatMessage, ChatSession
from chats.permissions import ChatPermission
from chats.serializers import ChatMessageSerializer, ChatOperatorMessageRequestSerializer, ChatPauseAIRequestSerializer, ChatSessionSerializer
from chats.services import mark_chat_read, mark_operator_needed, pause_ai_until, resume_ai, send_operator_message
from common.audit import log_audit_event, snapshot_instance
from common.models import AuditLog


class ChatSessionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = ChatSessionSerializer
    permission_classes = [IsAuthenticated, ChatPermission]
    queryset = ChatSession.objects.select_related("client").order_by("-updated_at")
    search_fields = ("title", "platform_user_id", "client__full_name", "client__phone", "client__interested_product")
    ordering_fields = ("updated_at", "created_at", "last_customer_message_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        platform = self.request.query_params.get("platform")
        operator_needed = self.request.query_params.get("operator_needed")
        if platform:
            queryset = queryset.filter(platform=platform)
        if operator_needed in {"true", "false"}:
            queryset = queryset.filter(operator_needed=(operator_needed == "true"))
        return queryset

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        session = self.get_object()
        data = ChatMessageSerializer(session.messages.all(), many=True).data
        return Response({"status": "success", "data": data})

    @action(detail=True, methods=["post"], url_path="send-message")
    def send_message(self, request, pk=None):
        serializer = ChatOperatorMessageRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = send_operator_message(self.get_object(), serializer.validated_data["content"], request.user)
        log_audit_event(
            actor=request.user,
            action=AuditLog.Action.ACTION,
            target_type="ChatSession",
            target_id=message.session_id,
            target_repr=str(message.session_id),
            after_data={"content": message.content},
            metadata={"operation": "send_message"},
        )
        return Response({"status": "success", "data": ChatMessageSerializer(message).data})

    @action(detail=True, methods=["post"], url_path="pause-ai")
    def pause_ai(self, request, pk=None):
        serializer = ChatPauseAIRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = pause_ai_until(self.get_object(), serializer.validated_data["paused_until"], serializer.validated_data.get("reason", ""))
        return Response({"status": "success", "data": ChatSessionSerializer(session).data})

    @action(detail=True, methods=["post"], url_path="resume-ai")
    def resume_ai_action(self, request, pk=None):
        session = resume_ai(self.get_object())
        return Response({"status": "success", "data": ChatSessionSerializer(session).data})

    @action(detail=True, methods=["post"], url_path="request-operator")
    def request_operator(self, request, pk=None):
        session = mark_operator_needed(self.get_object(), "manual_request")
        return Response({"status": "success", "data": ChatSessionSerializer(session).data})

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        session = mark_chat_read(self.get_object())
        return Response({"status": "success", "data": ChatSessionSerializer(session).data})

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()
        before = snapshot_instance(session)
        log_audit_event(
            actor=request.user,
            action=AuditLog.Action.DELETE,
            target_type="ChatSession",
            target_id=session.id,
            target_repr=str(session),
            before_data=before,
        )
        return super().destroy(request, *args, **kwargs)
