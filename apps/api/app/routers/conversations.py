from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent_shared.constants import (
    EVENT_ESCALATION,
    JOB_SEND_MESSAGE,
    STATE_BOT,
    STATE_CLOSED,
    STATE_HANDOFF,
)
from agent_shared.schemas import SendMessageJob
from app.auth import ServiceAuth, TenantId
from app.db import get_db
from app.models import Agent, Conversation, Event, Lead, Message
from app.queue import enqueue
from app.redis_client import publish_ws
from app.schemas import (
    ConversationOut,
    EventOut,
    MessageOut,
    OperatorMessageRequest,
)
from app.services import add_event, bump_script_metrics

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    _: ServiceAuth,
    tenant_id: TenantId,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    q = select(Conversation).where(Conversation.tenant_id == tenant_id).order_by(
        Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc()
    )
    if state:
        q = q.where(Conversation.state == state)
    return list((await db.execute(q)).scalars().all())


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: UUID,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    return conv


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: UUID,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> list[Message]:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    rows = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.tenant_id == tenant_id)
            .order_by(Message.created_at.asc())
        )
    ).scalars().all()
    return list(rows)


@router.get("/{conversation_id}/events", response_model=list[EventOut])
async def list_events(
    conversation_id: UUID,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> list[Event]:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    rows = (
        await db.execute(
            select(Event)
            .where(Event.conversation_id == conversation_id, Event.tenant_id == tenant_id)
            .order_by(Event.created_at.asc())
        )
    ).scalars().all()
    return list(rows)


@router.post("/{conversation_id}/handoff", response_model=ConversationOut)
async def handoff(
    conversation_id: UUID,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    conv.state = STATE_HANDOFF
    await add_event(db, tenant_id, conv.id, EVENT_ESCALATION, {"by": "operator"})
    if conv.script_id and conv.script_version:
        await bump_script_metrics(
            db, tenant_id, conv.script_id, conv.script_version, handoffs=1
        )
    await db.commit()
    await db.refresh(conv)
    await publish_ws(
        str(tenant_id),
        {"type": "handoff", "tenant_id": str(tenant_id), "conversation_id": str(conv.id)},
    )
    return conv


@router.post("/{conversation_id}/resume-bot", response_model=ConversationOut)
async def resume_bot(
    conversation_id: UUID,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    conv.state = STATE_BOT
    await add_event(db, tenant_id, conv.id, "resume_bot", {})
    await db.commit()
    await db.refresh(conv)
    await publish_ws(
        str(tenant_id),
        {"type": "resume_bot", "tenant_id": str(tenant_id), "conversation_id": str(conv.id)},
    )
    return conv


@router.post("/{conversation_id}/close", response_model=ConversationOut)
async def close_conversation(
    conversation_id: UUID,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    conv.state = STATE_CLOSED
    await add_event(db, tenant_id, conv.id, "closed", {"by": "operator"})
    if conv.script_id and conv.script_version:
        await bump_script_metrics(db, tenant_id, conv.script_id, conv.script_version, closed=1)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.post("/{conversation_id}/operator-message", response_model=MessageOut)
async def operator_message(
    conversation_id: UUID,
    body: OperatorMessageRequest,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> Message:
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.tenant_id != tenant_id:
        raise HTTPException(404, "Not found")
    if conv.state == STATE_CLOSED:
        raise HTTPException(400, "Conversation closed")

    agent = await db.get(Agent, conv.agent_id)
    lead = await db.get(Lead, conv.lead_id)
    if not agent or not agent.telegram_account_id or not lead:
        raise HTTPException(400, "Missing agent/lead")

    msg = Message(
        tenant_id=tenant_id,
        conversation_id=conv.id,
        direction="out",
        text=body.text,
        tokens_used=0,
        source="operator",
    )
    conv.state = STATE_HANDOFF
    conv.last_message_at = datetime.now(timezone.utc)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    job = SendMessageJob(
        tenant_id=str(tenant_id),
        conversation_id=str(conv.id),
        telegram_account_id=str(agent.telegram_account_id),
        lead_telegram_id=lead.telegram_id,
        lead_username=lead.telegram_username,
        text=body.text,
        message_id=str(msg.id),
        show_typing=True,
    )
    await enqueue(JOB_SEND_MESSAGE, **job.model_dump())
    await publish_ws(
        str(tenant_id),
        {
            "type": "message",
            "tenant_id": str(tenant_id),
            "conversation_id": str(conv.id),
            "payload": {"direction": "out", "text": body.text, "source": "operator"},
        },
    )
    return msg
