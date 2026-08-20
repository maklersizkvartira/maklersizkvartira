from django.test import TestCase
from rest_framework.test import APIClient

from common.audit import log_audit_event
from common.models import AuditLog
from users.models import User


class AuditLogVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="admin-log", password="Password123!", role=User.Role.ADMIN)
        self.developer = User.objects.create_user(username="developer-log", password="Password123!", role=User.Role.DEVELOPER)
        log_audit_event(actor=self.developer, action=AuditLog.Action.LOGIN, target_type="auth", target_id=self.developer.id, target_repr=self.developer.username)
        log_audit_event(actor=self.admin, action=AuditLog.Action.LOGIN, target_type="auth", target_id=self.admin.id, target_repr=self.admin.username)

    def test_admin_does_not_see_developer_logs(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/audit-logs/")
        self.assertEqual(response.status_code, 200)
        usernames = {row["actor_username"] for row in response.data["results"]}
        self.assertIn(self.admin.username, usernames)
        self.assertNotIn(self.developer.username, usernames)
