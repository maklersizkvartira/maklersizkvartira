from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from chats.models import ChatMessage, ChatSession
from chats.realtime import broadcast_chat_message, broadcast_chat_session_update


QUIET_WINDOW_SECONDS = 5


def get_or_create_session(platform: str, platform_user_id: str, title: str = "") -> ChatSession:
    session, _ = ChatSession.objects.get_or_create(
        platform=platform,
        platform_user_id=platform_user_id,
        defaults={"title": title or f"{platform}:{platform_user_id}"},
    )
    if title and not session.title:
        session.title = title
        session.save(update_fields=["title", "updated_at"])
    return session


@transaction.atomic
def enqueue_inbound_message(platform: str, platform_user_id: str, message: str, raw_payload: dict | None = None, title: str = ""):
    session = get_or_create_session(platform, platform_user_id, title=title)
    incoming = ChatMessage.objects.create(
        session=session,
        direction=ChatMessage.Direction.IN,
        sender_type=ChatMessage.SenderType.CLIENT,
        content=message,
        raw_payload=raw_payload or {},
    )
    session.last_customer_message_at = incoming.created_at
    session.save(update_fields=["last_customer_message_at", "updated_at"])
    broadcast_chat_message(session, incoming)
    broadcast_chat_session_update(session)
    return session, incoming


def get_pending_customer_messages(session: ChatSession):
    queryset = session.messages.filter(
        direction=ChatMessage.Direction.IN,
        sender_type=ChatMessage.SenderType.CLIENT,
    )
    if session.last_ai_processed_customer_at:
        queryset = queryset.filter(created_at__gt=session.last_ai_processed_customer_at)
    return queryset.order_by("created_at")


def quiet_window_passed(session: ChatSession) -> bool:
    if not session.last_customer_message_at:
        return False
    return timezone.now() >= session.last_customer_message_at + timedelta(seconds=QUIET_WINDOW_SECONDS)


def mark_customer_messages_processed(session: ChatSession, latest_message: ChatMessage):
    session.last_ai_processed_customer_at = latest_message.created_at
    session.save(update_fields=["last_ai_processed_customer_at", "updated_at"])


def create_ai_message(session: ChatSession, content: str):
    outgoing = ChatMessage.objects.create(
        session=session,
        direction=ChatMessage.Direction.OUT,
        sender_type=ChatMessage.SenderType.AI,
        content=content,
        raw_payload={},
    )
    broadcast_chat_message(session, outgoing)
    broadcast_chat_session_update(session)
    return outgoing


def send_operator_message(session: ChatSession, content: str, user):
    session.last_operator_message_at = timezone.now()
    session.operator_needed = False
    session.ai_paused_until = timezone.now() + timedelta(minutes=30)
    session.ai_pause_reason = "operator_reply"
    session.save(
        update_fields=["last_operator_message_at", "operator_needed", "ai_paused_until", "ai_pause_reason", "updated_at"]
    )
    message = ChatMessage.objects.create(
        session=session,
        direction=ChatMessage.Direction.OUT,
        sender_type=ChatMessage.SenderType.OPERATOR,
        sender_user=user,
        content=content,
        raw_payload={"sender_user_id": str(user.id)},
    )
    broadcast_chat_message(session, message)
    broadcast_chat_session_update(session)
    return message


def pause_ai_until(session: ChatSession, paused_until, reason: str = ""):
    session.ai_paused_until = paused_until
    session.ai_pause_reason = reason
    session.save(update_fields=["ai_paused_until", "ai_pause_reason", "updated_at"])
    broadcast_chat_session_update(session)
    return session


def resume_ai(session: ChatSession):
    session.ai_paused_until = None
    session.ai_pause_reason = ""
    session.operator_needed = False
    session.save(update_fields=["ai_paused_until", "ai_pause_reason", "operator_needed", "updated_at"])
    broadcast_chat_session_update(session)
    return session


def mark_operator_needed(session: ChatSession, reason: str = ""):
    session.operator_needed = True
    session.ai_pause_reason = reason
    session.save(update_fields=["operator_needed", "ai_pause_reason", "updated_at"])
    broadcast_chat_session_update(session)
    return session


def mark_chat_read(session: ChatSession):
    session.last_read_at = timezone.now()
    session.save(update_fields=["last_read_at", "updated_at"])
    broadcast_chat_session_update(session)
    return session
