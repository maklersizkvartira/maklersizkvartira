from users.models import OperatorPermission, User


def sync_permissions(user: User, permissions: list[str]) -> None:
    OperatorPermission.objects.filter(user=user).delete()
    if user.role == User.Role.DEVELOPER:
        return
    OperatorPermission.objects.bulk_create(
        [OperatorPermission(user=user, permission_key=permission_key) for permission_key in permissions]
    )


def create_user(validated_data: dict) -> User:
    permissions = validated_data.pop("permissions", [])
    password = validated_data.pop("password", None)
    user = User.objects.create(**validated_data)
    if password:
        user.set_password(password)
        user.save(update_fields=["password"])
    sync_permissions(user, permissions)
    return user


def update_user(user: User, validated_data: dict) -> User:
    permissions = validated_data.pop("permissions", None)
    password = validated_data.pop("password", None)
    for key, value in validated_data.items():
        setattr(user, key, value)
    if password:
        user.set_password(password)
    user.save()
    if permissions is not None:
        sync_permissions(user, permissions)
    return user
