from django.urls import path

from users.views import AllPermissionsView, AuthPermissionsView, AuthRolesView, LoginView, MeView, RefreshView

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("permissions/", AuthPermissionsView.as_view(), name="auth-permissions"),
    path("permissions/all/", AllPermissionsView.as_view(), name="auth-permissions-all"),
    path("roles/", AuthRolesView.as_view(), name="auth-roles"),
]
