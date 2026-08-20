import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from clients.models import Client


class ChatSession(models.Model):
    class Platform(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        INSTAGRAM = "instagram", "Instagram"
        WHATSAPP = "whatsapp", "WhatsApp"
        WEB = "web", "Web"
        MANUAL = "manual", "Manual"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="chat_sessions")
    platform = models.CharField(max_length=20, choices=Platform.choices)
    platform_user_id = models.CharField(max_length=128)
    title = models.CharField(max_length=255, blank=True)
    state = models.CharField(max_length=64, default="active")
    detected_language = models.CharField(max_length=20, blank=True)
    profile_snapshot = models.JSONField(default=dict, blank=True)
    operator_needed = models.BooleanField(default=False)
    ai_paused_until = models.DateTimeField(null=True, blank=True)
    ai_pause_reason = models.CharField(max_length=255, blank=True)
    last_customer_message_at = models.DateTimeField(null=True, blank=True)
    last_ai_processed_customer_at = models.DateTimeField(null=True, blank=True)
    last_operator_message_at = models.DateTimeField(null=True, blank=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        unique_together = ("platform", "platform_user_id")

    @property
    def ai_enabled(self):
        return not self.ai_paused_until or self.ai_paused_until <= timezone.now()


class ChatMessage(models.Model):
    class Direction(models.TextChoices):
        IN = "in", "Incoming"
        OUT = "out", "Outgoing"

    class SenderType(models.TextChoices):
        CLIENT = "client", "Client"
        AI = "ai", "AI"
        OPERATOR = "operator", "Operator"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    direction = models.CharField(max_length=3, choices=Direction.choices)
    sender_type = models.CharField(max_length=20, choices=SenderType.choices)
    sender_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )
    content = models.TextField()
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

