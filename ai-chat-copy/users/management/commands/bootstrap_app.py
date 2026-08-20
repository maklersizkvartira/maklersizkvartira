from django.core.management.base import BaseCommand

from ai.models import AISettings
from clients.models import ClientStatus
from integrations.models import IntegrationConfig
from users.models import User


class Command(BaseCommand):
    help = "Create default developer user and default settings"

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username="developer",
            defaults={
                "role": User.Role.DEVELOPER,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        user.role = User.Role.DEVELOPER
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password("Password123!")
        user.save()

        ai_settings, _ = AISettings.objects.get_or_create(
            name="default",
            defaults={
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "is_active": True,
                "function_calling_enabled": True,
                "system_prompt": (
                    "Siz AvikonCRM savdo yordamchisisiz. "
                    "Faqat system prompt va function calls bilan ishlang. "
                    "Mijoz bilan tabiiy muloqot qiling. "
                    "Client yaratish uchun kerakli minimum ma'lumotlar: ism va telefon. "
                    "Agar mijoz qiziqqan mahsulotni aytsa, interested_product ga yozing. "
                    "Agar mijoz ism yoki raqamini to'g'rilasa, mavjud clientni update qiling."
                ),
            },
        )
        ai_settings.model = "gpt-4o-mini"
        ai_settings.temperature = 0.2
        ai_settings.is_active = True
        ai_settings.function_calling_enabled = True
        ai_settings.system_prompt = (
            "Siz AvikonCRM savdo yordamchisisiz. "
            "Faqat system prompt va function calls bilan ishlang. "
            "Mijoz bilan tabiiy muloqot qiling. "
            "Client yaratish uchun kerakli minimum ma'lumotlar: ism va telefon. "
            "Agar mijoz qiziqqan mahsulotni aytsa, interested_product ga yozing. "
            "Agar mijoz ism yoki raqamini to'g'rilasa, mavjud clientni update qiling."
        )
        ai_settings.save()

        for provider, key, description in [
            ("openai", "api_key", "OpenAI API key"),
            ("telegram", "bot_token", "Telegram bot token"),
            ("instagram", "access_token", "Instagram access token"),
            ("instagram", "business_id", "Instagram business id"),
            ("instagram", "verify_token", "Instagram webhook verify token"),
        ]:
            config, _ = IntegrationConfig.objects.get_or_create(
                provider=provider,
                key=key,
                defaults={"description": description, "is_active": True},
            )
            if provider == "instagram" and key == "verify_token":
                config.value = ":killer;"
                config.is_active = True
                config.description = description
                config.save(update_fields=["value", "is_active", "description", "updated_at"])

        for index, (name, slug, color, is_default) in enumerate(
            [
                ("New", "new", "#3b82f6", True),
                ("Canceled", "canceled", "#ef4444", False),
            ]
        ):
            status, _ = ClientStatus.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "color": color, "is_default": is_default, "sort_order": index},
            )
            status.name = name
            status.color = color
            status.is_default = is_default
            status.sort_order = index
            status.save()

        message = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Developer user {message}: developer / Password123!"))
