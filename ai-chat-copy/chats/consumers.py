from channels.generic.websocket import AsyncJsonWebsocketConsumer


class BaseChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        await self.accept()
        await self.after_accept()

    async def after_accept(self):
        return None

    async def disconnect(self, code):
        await self.after_disconnect()

    async def after_disconnect(self):
        return None

    async def chat_event(self, event):
        await self.send_json(event["payload"])


class ChatSessionsConsumer(BaseChatConsumer):
    async def after_accept(self):
        await self.channel_layer.group_add("chats", self.channel_name)
        await self.send_json({"type": "connection.ready", "scope": "chats"})

    async def after_disconnect(self):
        await self.channel_layer.group_discard("chats", self.channel_name)


class ChatSessionEventsConsumer(BaseChatConsumer):
    async def after_accept(self):
        self.session_group = f"chat_{self.scope['url_route']['kwargs']['session_id']}"
        await self.channel_layer.group_add(self.session_group, self.channel_name)
        await self.send_json({"type": "connection.ready", "scope": "chat", "session_id": str(self.scope["url_route"]["kwargs"]["session_id"])})

    async def after_disconnect(self):
        await self.channel_layer.group_discard(self.session_group, self.channel_name)
