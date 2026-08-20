from django.urls import path

from chats.consumers import ChatSessionEventsConsumer, ChatSessionsConsumer

websocket_urlpatterns = [
    path("ws/chats/", ChatSessionsConsumer.as_asgi()),
    path("ws/chats/<uuid:session_id>/", ChatSessionEventsConsumer.as_asgi()),
]
