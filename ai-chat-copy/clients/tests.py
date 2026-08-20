from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import ClientStatus
from users.models import User


class ClientApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="admin-client", password="Password123!", role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)
        self.status = ClientStatus.objects.create(name="New", slug="new", color="#3b82f6", is_default=True)

    def test_client_api_accepts_minimal_fields(self):
        response = self.client.post(
            "/api/clients/",
            {
                "full_name": "Ali Valiyev",
                "phone": "+998901234567",
                "interested_product": "Kamera",
                "notes": "Call back",
                "status": str(self.status.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["interested_product"], "Kamera")
        self.assertEqual(response.data["status_color"], "#3b82f6")

    def test_status_api_returns_color(self):
        response = self.client.get("/api/clients/statuses/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["color"], "#3b82f6")
