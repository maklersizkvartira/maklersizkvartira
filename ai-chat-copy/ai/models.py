import uuid

from django.db import models


class AISettings(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80, unique=True, default="default")
    model = models.CharField(max_length=80, default="gpt-4o-mini")
    temperature = models.FloatField(default=0.2)
    system_prompt = models.TextField()
    function_calling_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self):
        return self.name
