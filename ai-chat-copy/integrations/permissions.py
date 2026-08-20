from common.permissions import RBACPermission


class IntegrationPermission(RBACPermission):
    def has_permission(self, request, view):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            self.required_permission = "integrations.view"
        else:
            self.required_permission = "integrations.manage"
        return super().has_permission(request, view)
