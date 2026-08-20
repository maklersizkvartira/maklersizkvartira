from common.permissions import RBACPermission


class AISettingsPermission(RBACPermission):
    def has_permission(self, request, view):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            self.required_permission = "ai.view"
        else:
            self.required_permission = "ai.manage"
        return super().has_permission(request, view)
