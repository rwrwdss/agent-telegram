from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from app.config import get_settings
from app.ids import resolve_tenant_id


async def verify_service_token(
    x_service_token: Annotated[str | None, Header()] = None,
) -> None:
    if not x_service_token or x_service_token != get_settings().service_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service token")


async def require_tenant_id(
    x_tenant_id: Annotated[str | None, Header()] = None,
) -> UUID:
    if not x_tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Tenant-Id required")
    return resolve_tenant_id(x_tenant_id)


ServiceAuth = Annotated[None, Depends(verify_service_token)]
TenantId = Annotated[UUID, Depends(require_tenant_id)]
