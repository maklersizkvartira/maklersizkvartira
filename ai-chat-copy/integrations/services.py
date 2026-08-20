from integrations.models import IntegrationConfig


def get_integration_value(provider: str, key: str, default: str = "") -> str:
    config = IntegrationConfig.objects.filter(provider=provider, key=key, is_active=True).order_by("-updated_at").first()
    if not config:
        return default
    return config.value
