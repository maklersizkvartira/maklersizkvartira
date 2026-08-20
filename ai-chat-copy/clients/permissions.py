from common.permissions import RBACPermission


class ClientPermission(RBACPermission):
    def has_permission(self, request, view):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            self.required_permission = "clients.view"
        else:
            self.required_permission = "clients.manage"
        return super().has_permission(request, view)
