from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from integrations.models import IntegrationEvent


class InboundWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("integrations.views.process_session_ai_task.apply_async")
    def test_post_creates_event_and_queues_ai_after_five_seconds(self, mock_apply_async):
        response = self.client.post(
            "/api/settings/integrations/webhooks/inbound/",
            {
                "platform": "telegram",
                "platform_user_id": "tg-1",
                "message": "Salom",
                "title": "Telegram user",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["data"]["queued_ai_delay_seconds"], 5)
        event = IntegrationEvent.objects.get()
        self.assertEqual(event.platform, "telegram")
        self.assertTrue(event.processed)
        mock_apply_async.assert_called_once()
        _, kwargs = mock_apply_async.call_args
        self.assertEqual(kwargs["countdown"], 5)
