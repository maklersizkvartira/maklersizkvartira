import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Role(models.TextChoices):
        DEVELOPER = "developer", "Developer"
        ADMIN = "admin", "Admin"
        OPERATOR = "operator", "Operator"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OPERATOR)

    @property
    def permissions(self) -> list[str]:
        if self.role == self.Role.DEVELOPER:
            from users.access import ROLE_DEFAULT_PERMISSIONS

            return ROLE_DEFAULT_PERMISSIONS["developer"]
        direct = list(self.operator_permissions.values_list("permission_key", flat=True))
        if direct:
            return direct
        from users.access import ROLE_DEFAULT_PERMISSIONS

        return ROLE_DEFAULT_PERMISSIONS.get(self.role, [])


class OperatorPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="operator_permissions")
    permission_key = models.CharField(max_length=120)

    class Meta:
        unique_together = ("user", "permission_key")

    def __str__(self):
        return f"{self.user.username}:{self.permission_key}"
