from rest_framework.permissions import BasePermission

from users.access import ROLE_DEFAULT_PERMISSIONS


class IsDeveloper(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == "developer")


class RBACPermission(BasePermission):
    required_permission = ""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == "developer":
            return True
        if not self.required_permission:
            return False
        if user.role == "admin":
            return self.required_permission in ROLE_DEFAULT_PERMISSIONS["admin"] or self.required_permission in user.permissions
        return self.required_permission in user.permissions


class IsAdminOrDeveloper(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in {"developer", "admin"})
