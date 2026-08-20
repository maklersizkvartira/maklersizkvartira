from dataclasses import asdict, is_dataclass
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from django.forms.models import model_to_dict

from common.models import AuditLog


def make_json_safe(value):
    if isinstance(value, dict):
        return {str(k): make_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [make_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [make_json_safe(v) for v in value]
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if is_dataclass(value):
        return make_json_safe(asdict(value))
    return value


def snapshot_instance(instance):
    data = model_to_dict(instance)
    for field in instance._meta.fields:
        if field.name in data and hasattr(field, "attname") and field.attname.endswith("_id") is False:
            raw_attr = getattr(instance, field.attname, None)
            if field.is_relation:
                data[field.name] = str(raw_attr) if raw_attr is not None else None
    return make_json_safe(data)


def log_audit_event(*, actor, action, target_type, target_id="", target_repr="", before_data=None, after_data=None, metadata=None):
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=str(target_id or ""),
        target_repr=target_repr or "",
        before_data=make_json_safe(before_data or {}),
        after_data=make_json_safe(after_data or {}),
        metadata=make_json_safe(metadata or {}),
    )


def log_model_event(*, actor, action, instance, before_data=None, metadata=None):
    after_data = {} if action == AuditLog.Action.DELETE else snapshot_instance(instance)
    return log_audit_event(
        actor=actor,
        action=action,
        target_type=instance.__class__.__name__,
        target_id=getattr(instance, "pk", ""),
        target_repr=str(instance),
        before_data=before_data or {},
        after_data=after_data,
        metadata=metadata or {},
    )
