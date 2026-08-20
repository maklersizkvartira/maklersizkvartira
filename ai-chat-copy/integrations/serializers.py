from rest_framework import serializers

from integrations.models import IntegrationConfig, IntegrationEvent


class IntegrationConfigSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationConfig
        fields = (
            "id",
            "provider",
            "key",
            "value",
            "is_active",
            "description",
            "updated_by",
            "updated_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("updated_by",)

    def get_updated_by_name(self, obj):
        if not obj.updated_by:
            return ""
        return obj.updated_by.get_full_name() or obj.updated_by.username


class IntegrationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationEvent
        fields = "__all__"
