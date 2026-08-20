from rest_framework import serializers

from users.models import User


class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_staff",
            "permissions",
        )

    def get_permissions(self, obj):
        return obj.permissions


class UserWriteSerializer(serializers.ModelSerializer):
    permissions = serializers.ListField(child=serializers.CharField(), required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_staff",
            "password",
            "permissions",
        )

    def validate(self, attrs):
        request = self.context.get("request")
        role = attrs.get("role") or getattr(self.instance, "role", None)
        if request and request.user.role != User.Role.DEVELOPER and role == User.Role.DEVELOPER:
            raise serializers.ValidationError("Developer userni yaratish yoki tahrirlash mumkin emas")
        return attrs


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()
