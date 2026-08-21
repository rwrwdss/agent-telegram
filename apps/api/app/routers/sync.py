from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import ServiceAuth, TenantId
from app.db import get_db
from app.schemas import SyncEntityRequest
from app.services import sync_entity

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("")
async def sync(
    body: SyncEntityRequest,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = {**body.data, "tenant_id": str(tenant_id)}
    try:
        result = await sync_entity(db, body.entity, body.payload_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True, **result}
