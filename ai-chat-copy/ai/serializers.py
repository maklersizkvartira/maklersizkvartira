from rest_framework import serializers

from ai.models import AISettings


class AISettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AISettings
        fields = "__all__"
