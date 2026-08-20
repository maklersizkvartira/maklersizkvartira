from common.permissions import IsDeveloper, RBACPermission


class IsDeveloperOnly(IsDeveloper):
    pass


class IsAdminOrDeveloperOnly(IsDeveloper):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in {"developer", "admin"})


class CanManageUsers(RBACPermission):
    required_permission = "users.manage"
