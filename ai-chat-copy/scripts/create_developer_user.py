import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from users.models import User  # noqa: E402

user, _ = User.objects.get_or_create(
    username="developer",
    defaults={"role": User.Role.DEVELOPER, "is_staff": True, "is_superuser": True, "is_active": True},
)
user.role = User.Role.DEVELOPER
user.is_staff = True
user.is_superuser = True
user.is_active = True
user.set_password("Password123!")
user.save()

print("developer / Password123!")
