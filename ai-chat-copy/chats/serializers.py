from rest_framework import serializers

from chats.models import ChatMessage, ChatSession


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = ChatMessage
        fields = ("id", "direction", "sender_type", "sender_user_id", "content", "raw_payload", "created_at")


class ChatSessionSerializer(serializers.ModelSerializer):
    ai_enabled = serializers.BooleanField(read_only=True)
    unread_count = serializers.SerializerMethodField()
    latest_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "client",
            "platform",
            "platform_user_id",
            "title",
            "state",
            "detected_language",
            "profile_snapshot",
            "operator_needed",
            "ai_paused_until",
            "ai_pause_reason",
            "last_customer_message_at",
            "last_ai_processed_customer_at",
            "last_operator_message_at",
            "last_read_at",
            "metadata",
            "ai_enabled",
            "unread_count",
            "latest_message",
            "created_at",
            "updated_at",
        )

    def get_unread_count(self, obj):
        queryset = obj.messages.filter(direction=ChatMessage.Direction.IN)
        if obj.last_read_at:
            queryset = queryset.filter(created_at__gt=obj.last_read_at)
        return queryset.count()

    def get_latest_message(self, obj):
        message = obj.messages.order_by("-created_at").first()
        if not message:
            return None
        return ChatMessageSerializer(message).data


class ChatOperatorMessageRequestSerializer(serializers.Serializer):
    content = serializers.CharField()


class ChatPauseAIRequestSerializer(serializers.Serializer):
    paused_until = serializers.DateTimeField()
    reason = serializers.CharField(required=False, allow_blank=True)
