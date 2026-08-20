from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User


class UserVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="admin-user", password="Password123!", role=User.Role.ADMIN)
        self.developer = User.objects.create_user(username="developer-user", password="Password123!", role=User.Role.DEVELOPER)
        self.client.force_authenticate(self.admin)

    def test_admin_cannot_create_developer_user(self):
        response = self.client.post(
            "/api/users/",
            {
                "username": "forbidden-dev",
                "role": "developer",
                "password": "Password123!",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
