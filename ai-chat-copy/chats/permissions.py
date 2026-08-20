from common.permissions import RBACPermission


class ChatPermission(RBACPermission):
    def has_permission(self, request, view):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            self.required_permission = "chats.view"
        else:
            self.required_permission = "chats.manage"
        return super().has_permission(request, view)
