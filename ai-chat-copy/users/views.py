from django.contrib.auth import authenticate
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from users.access import PERMISSION_CATALOG, get_visible_permissions_for_role, get_visible_roles_for_role
from common.audit import log_audit_event, log_model_event, snapshot_instance
from common.models import AuditLog
from users.models import User
from users.permissions import CanManageUsers, IsAdminOrDeveloperOnly
from users.serializers import LoginRequestSerializer, UserSerializer, UserWriteSerializer
from users.services import create_user, update_user


class LoginView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LoginRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(**serializer.validated_data)
        if not user:
            return Response({"status": "error", "message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        refresh = RefreshToken.for_user(user)
        log_audit_event(actor=user, action=AuditLog.Action.LOGIN, target_type="auth", target_id=user.id, target_repr=user.username)
        return Response(
            {
                "status": "success",
                "data": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserSerializer(user).data,
                },
            }
        )


class RefreshView(TokenRefreshView):
    serializer_class = TokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code >= 400:
            return Response({"status": "error", "message": "Invalid refresh token"}, status=response.status_code)
        return Response({"status": "success", "data": {"access": response.data["access"]}})


class MeView(GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"status": "success", "data": UserSerializer(request.user).data})


class AuthPermissionsView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrDeveloperOnly]

    def get(self, request):
        return Response({"status": "success", "data": get_visible_permissions_for_role(request.user.role)})


class AuthRolesView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrDeveloperOnly]

    def get(self, request):
        return Response({"status": "success", "data": get_visible_roles_for_role(request.user.role)})


class AllPermissionsView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrDeveloperOnly]

    def get(self, request):
        if request.user.role == User.Role.DEVELOPER:
            data = PERMISSION_CATALOG
        else:
            data = get_visible_permissions_for_role(request.user.role)
        return Response({"status": "success", "data": data})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by("-date_joined")
    permission_classes = [IsAuthenticated, CanManageUsers]
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("date_joined", "username")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role != User.Role.DEVELOPER:
            return queryset.exclude(role=User.Role.DEVELOPER)
        return queryset

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated(), IsAdminOrDeveloperOnly()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return UserWriteSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = create_user(serializer.validated_data)
        log_model_event(actor=request.user, action=AuditLog.Action.CREATE, instance=user)
        return Response({"status": "success", "data": UserSerializer(user).data}, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        before = snapshot_instance(user)
        serializer = self.get_serializer(user, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        user = update_user(user, serializer.validated_data)
        log_model_event(actor=request.user, action=AuditLog.Action.UPDATE, instance=user, before_data=before)
        return Response({"status": "success", "data": UserSerializer(user).data})

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        before = snapshot_instance(user)
        log_model_event(actor=request.user, action=AuditLog.Action.DELETE, instance=user, before_data=before)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def permissions(self, request, pk=None):
        return Response({"status": "success", "data": self.get_object().permissions})
