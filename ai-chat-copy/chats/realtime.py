from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from chats.serializers import ChatMessageSerializer, ChatSessionSerializer


def broadcast_chat_session_update(session):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    payload = {
        "type": "chat.session_updated",
        "session": ChatSessionSerializer(session).data,
    }
    async_to_sync(channel_layer.group_send)("chats", {"type": "chat.event", "payload": payload})
    async_to_sync(channel_layer.group_send)(f"chat_{session.id}", {"type": "chat.event", "payload": payload})


def broadcast_chat_message(session, message):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    payload = {
        "type": "chat.message_created",
        "session_id": str(session.id),
        "message": ChatMessageSerializer(message).data,
    }
    async_to_sync(channel_layer.group_send)("chats", {"type": "chat.event", "payload": payload})
    async_to_sync(channel_layer.group_send)(f"chat_{session.id}", {"type": "chat.event", "payload": payload})
