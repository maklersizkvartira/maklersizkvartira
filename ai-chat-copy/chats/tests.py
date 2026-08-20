from django.test import TestCase

from chats.models import ChatSession
from chats.services import enqueue_inbound_message


class ChatQueueTests(TestCase):
    def test_enqueue_inbound_message_updates_quiet_window_state(self):
        session, incoming = enqueue_inbound_message("telegram", "user-1", "salom")
        self.assertIsInstance(session, ChatSession)
        self.assertEqual(incoming.content, "salom")
        self.assertIsNotNone(session.last_customer_message_at)
