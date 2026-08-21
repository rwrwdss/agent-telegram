from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent_shared.constants import EVENT_STARTED, WARMUP_DAILY_LIMITS
from app.ids import parse_optional_uuid, resolve_tenant_id
from app.models import (
    Agent,
    Conversation,
    Event,
    Lead,
    Script,
    ScriptMetrics,
    TelegramAccount,
    Tenant,
    UsageDaily,
)


async def get_or_create_tenant(session: AsyncSession, tenant_id: UUID, name: str = "Tenant") -> Tenant:
    t = await session.get(Tenant, tenant_id)
    if t:
        return t
    t = Tenant(id=tenant_id, name=name, plan="starter", limits={})
    session.add(t)
    await session.flush()
    return t


async def sync_entity(session: AsyncSession, entity: str, payload_id: str, data: dict[str, Any]) -> dict[str, Any]:
    entity = entity.lower().replace("_", "-")

    if entity in ("tenants", "tenant"):
        tid = resolve_tenant_id(str(data.get("id") or payload_id))
        t = await session.get(Tenant, tid)
        if not t:
            t = Tenant(id=tid)
            session.add(t)
        t.name = data.get("name") or t.name or "Tenant"
        t.plan = data.get("plan") or t.plan or "starter"
        t.limits = data.get("limits") or t.limits or {}
        await session.commit()
        return {"id": str(t.id)}

    raw_tenant = data.get("tenant_id") or data.get("tenant")
    if not raw_tenant:
        raise ValueError("tenant_id required")
    tenant_id = resolve_tenant_id(str(raw_tenant))
    await get_or_create_tenant(session, tenant_id, name=str(data.get("tenant_name") or "Tenant"))

    if entity in ("telegram-accounts", "telegram_accounts"):
        row = (
            await session.execute(select(TelegramAccount).where(TelegramAccount.payload_id == payload_id))
        ).scalar_one_or_none()
        if not row:
            row = TelegramAccount(tenant_id=tenant_id, phone=data.get("phone") or "", payload_id=payload_id)
            session.add(row)
        row.tenant_id = tenant_id
        row.phone = data.get("phone") or row.phone
        if data.get("status"):
            row.status = data["status"]
        if data.get("daily_limit") is not None:
            row.daily_limit = int(data["daily_limit"])
        if data.get("warmup_stage") is not None:
            row.warmup_stage = int(data["warmup_stage"])
            row.daily_limit = WARMUP_DAILY_LIMITS.get(row.warmup_stage, row.daily_limit)
        if data.get("session_encrypted"):
            row.session_encrypted = data["session_encrypted"]
        await session.commit()
        return {"id": str(row.id), "payload_id": payload_id}

    if entity in ("scripts", "script"):
        row = (await session.execute(select(Script).where(Script.payload_id == payload_id))).scalar_one_or_none()
        if not row:
            row = Script(tenant_id=tenant_id, name=data.get("name") or "Script", payload_id=payload_id)
            session.add(row)
        row.tenant_id = tenant_id
        row.name = data.get("name") or row.name
        row.version = str(data.get("version") or row.version or "1")
        row.system_prompt = data.get("system_prompt") or row.system_prompt or ""
        row.steps_json = data.get("steps_json") or data.get("steps") or row.steps_json or {}
        row.fallback_rules = data.get("fallback_rules") or row.fallback_rules or {}
        await session.commit()
        return {"id": str(row.id)}

    if entity in ("agents", "agent"):
        row = (await session.execute(select(Agent).where(Agent.payload_id == payload_id))).scalar_one_or_none()
        if not row:
            row = Agent(tenant_id=tenant_id, name=data.get("name") or "Agent", payload_id=payload_id)
            session.add(row)
        row.tenant_id = tenant_id
        row.name = data.get("name") or row.name
        row.llm_model = data.get("llm_model") or row.llm_model
        row.temperature = float(
            data["temperature"]
            if data.get("temperature") is not None
            else (row.temperature if row.temperature is not None else 0.7)
        )
        row.status = data.get("status") or row.status
        tg = data.get("telegram_account_id") or data.get("telegramAccount")
        sc = data.get("script_id") or data.get("script")
        if tg:
            tg_uuid = parse_optional_uuid(tg)
            if tg_uuid:
                row.telegram_account_id = tg_uuid
            else:
                acc = (
                    await session.execute(select(TelegramAccount).where(TelegramAccount.payload_id == str(tg)))
                ).scalar_one_or_none()
                if acc:
                    row.telegram_account_id = acc.id
        if sc:
            sc_uuid = parse_optional_uuid(sc)
            if sc_uuid:
                row.script_id = sc_uuid
            else:
                script = (
                    await session.execute(select(Script).where(Script.payload_id == str(sc)))
                ).scalar_one_or_none()
                if script:
                    row.script_id = script.id
        await session.commit()
        return {"id": str(row.id)}

    if entity in ("leads", "lead"):
        row = (await session.execute(select(Lead).where(Lead.payload_id == payload_id))).scalar_one_or_none()
        if not row:
            row = Lead(tenant_id=tenant_id, payload_id=payload_id)
            session.add(row)
        row.tenant_id = tenant_id
        row.telegram_username = (
            data.get("telegram_username") or data.get("telegramUsername") or row.telegram_username
        )
        tid = data.get("telegram_id") or data.get("telegramId")
        if tid is not None:
            row.telegram_id = int(tid)
        row.source = data.get("source") or row.source
        row.status = data.get("status") or row.status
        row.custom_fields_json = (
            data.get("custom_fields_json") or data.get("customFields") or row.custom_fields_json or {}
        )
        await session.commit()
        return {"id": str(row.id)}

    raise ValueError(f"Unknown entity: {entity}")


async def bump_usage(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    tokens: int = 0,
    messages_out: int = 0,
    conversations_started: int = 0,
    conversions: int = 0,
) -> None:
    today = date.today()
    row = (
        await session.execute(
            select(UsageDaily).where(UsageDaily.tenant_id == tenant_id, UsageDaily.day == today)
        )
    ).scalar_one_or_none()
    if not row:
        row = UsageDaily(
            tenant_id=tenant_id,
            day=today,
            tokens_total=0,
            messages_out=0,
            conversations_started=0,
            conversions=0,
        )
        session.add(row)
    row.tokens_total = (row.tokens_total or 0) + tokens
    row.messages_out = (row.messages_out or 0) + messages_out
    row.conversations_started = (row.conversations_started or 0) + conversations_started
    row.conversions = (row.conversions or 0) + conversions


async def bump_script_metrics(
    session: AsyncSession,
    tenant_id: UUID,
    script_id: UUID,
    script_version: str,
    *,
    started: int = 0,
    converted: int = 0,
    closed: int = 0,
    handoffs: int = 0,
) -> None:
    row = (
        await session.execute(
            select(ScriptMetrics).where(
                ScriptMetrics.tenant_id == tenant_id,
                ScriptMetrics.script_id == script_id,
                ScriptMetrics.script_version == script_version,
            )
        )
    ).scalar_one_or_none()
    if not row:
        row = ScriptMetrics(
            tenant_id=tenant_id,
            script_id=script_id,
            script_version=script_version,
            started=0,
            converted=0,
            closed=0,
            handoffs=0,
        )
        session.add(row)
    row.started = (row.started or 0) + started
    row.converted = (row.converted or 0) + converted
    row.closed = (row.closed or 0) + closed
    row.handoffs = (row.handoffs or 0) + handoffs


async def add_event(
    session: AsyncSession,
    tenant_id: UUID,
    conversation_id: UUID,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> Event:
    ev = Event(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        type=event_type,
        payload=payload or {},
    )
    session.add(ev)
    return ev


async def create_conversations_for_campaign(
    session: AsyncSession,
    tenant_id: UUID,
    agent_id: UUID,
    lead_ids: list[UUID],
) -> list[Conversation]:
    agent = await session.get(Agent, agent_id)
    if not agent or agent.tenant_id != tenant_id:
        raise ValueError("Agent not found")
    if not agent.script_id or not agent.telegram_account_id:
        raise ValueError("Agent missing script or telegram account")

    script = await session.get(Script, agent.script_id)
    if not script:
        raise ValueError("Script not found")

    steps = script.steps_json or {}
    start_step = "start"
    if isinstance(steps, dict) and "initial" in steps:
        start_step = str(steps["initial"])
    elif isinstance(steps, dict) and "start" in (steps.get("nodes") or steps):
        start_step = "start"

    conversations: list[Conversation] = []
    for lead_id in lead_ids:
        lead = await session.get(Lead, lead_id)
        if not lead or lead.tenant_id != tenant_id:
            continue
        conv = Conversation(
            tenant_id=tenant_id,
            lead_id=lead.id,
            agent_id=agent.id,
            script_id=script.id,
            script_version=script.version,
            current_step=start_step,
            state="bot",
        )
        session.add(conv)
        conversations.append(conv)

    await session.flush()
    for conv in conversations:
        await add_event(session, tenant_id, conv.id, EVENT_STARTED, {"agent_id": str(agent_id)})
        if conv.script_id and conv.script_version:
            await bump_script_metrics(
                session, tenant_id, conv.script_id, conv.script_version, started=1
            )
        await bump_usage(session, tenant_id, conversations_started=1)
        lead = await session.get(Lead, conv.lead_id)
        if lead:
            lead.status = "in_progress"

    await session.commit()
    for conv in conversations:
        await session.refresh(conv)
    return conversations
