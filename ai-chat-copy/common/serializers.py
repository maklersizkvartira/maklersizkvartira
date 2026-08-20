from rest_framework import serializers

from common.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_username",
            "action",
            "target_type",
            "target_id",
            "target_repr",
            "before_data",
            "after_data",
            "metadata",
            "created_at",
        )
