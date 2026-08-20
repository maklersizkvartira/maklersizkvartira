from rest_framework import serializers

from clients.models import Client, ClientStatus


class ClientStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientStatus
        fields = ("id", "name", "slug", "color", "is_default", "sort_order", "created_at", "updated_at")


class ClientSerializer(serializers.ModelSerializer):
    status_name = serializers.CharField(source="status.name", read_only=True)
    status_color = serializers.CharField(source="status.color", read_only=True)

    class Meta:
        model = Client
        fields = (
            "id",
            "full_name",
            "phone",
            "interested_product",
            "notes",
            "status",
            "status_name",
            "status_color",
            "created_at",
            "updated_at",
        )
