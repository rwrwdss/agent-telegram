from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from agent_shared.constants import JOB_START_CONVERSATION
from agent_shared.schemas import StartConversationJob
from app.auth import ServiceAuth, TenantId
from app.db import get_db
from app.queue import enqueue
from app.schemas import CampaignStartRequest, CampaignStartResponse
from app.services import create_conversations_for_campaign

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("/start", response_model=CampaignStartResponse)
async def start_campaign(
    body: CampaignStartRequest,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> CampaignStartResponse:
    try:
        conversations = await create_conversations_for_campaign(
            db, tenant_id, body.agent_id, body.lead_ids
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    for conv in conversations:
        job = StartConversationJob(
            tenant_id=str(tenant_id),
            agent_id=str(body.agent_id),
            lead_id=str(conv.lead_id),
            conversation_id=str(conv.id),
        )
        await enqueue(JOB_START_CONVERSATION, **job.model_dump())

    return CampaignStartResponse(
        conversation_ids=[c.id for c in conversations],
        enqueued=len(conversations),
    )
