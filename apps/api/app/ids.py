from __future__ import annotations

import uuid
from uuid import UUID


def resolve_tenant_id(raw: str | UUID) -> UUID:
    """Map Payload numeric/string tenant id to a stable runtime UUID."""
    if isinstance(raw, UUID):
        return raw
    try:
        return UUID(str(raw))
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_OID, f"tenant:{raw}")


def parse_optional_uuid(value: object) -> UUID | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except ValueError:
        return None
