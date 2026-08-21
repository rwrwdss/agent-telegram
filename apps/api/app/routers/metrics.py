from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import ServiceAuth, TenantId
from app.db import get_db
from app.models import ScriptMetrics, UsageDaily
from app.schemas import ScriptMetricsOut, UsageDailyOut

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/usage", response_model=list[UsageDailyOut])
async def usage(
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> list[UsageDaily]:
    rows = (
        await db.execute(
            select(UsageDaily)
            .where(UsageDaily.tenant_id == tenant_id)
            .order_by(UsageDaily.day.desc())
            .limit(90)
        )
    ).scalars().all()
    return list(rows)


@router.get("/scripts", response_model=list[ScriptMetricsOut])
async def script_metrics(
    _: ServiceAuth,
    tenant_id: TenantId,
    script_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[ScriptMetricsOut]:
    q = select(ScriptMetrics).where(ScriptMetrics.tenant_id == tenant_id)
    if script_id:
        q = q.where(ScriptMetrics.script_id == script_id)
    rows = (await db.execute(q)).scalars().all()
    out: list[ScriptMetricsOut] = []
    for r in rows:
        rate = (r.converted / r.started) if r.started else 0.0
        out.append(
            ScriptMetricsOut(
                script_id=r.script_id,
                script_version=r.script_version,
                started=r.started,
                converted=r.converted,
                closed=r.closed,
                handoffs=r.handoffs,
                conversion_rate=round(rate, 4),
            )
        )
    return out
