from __future__ import annotations

import logging
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

# Allow importing apps.api.app
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))
sys.path.insert(0, str(ROOT / "packages" / "shared"))

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select

from agent_shared.constants import (
    DIR_IN,
    DIR_OUT,
    EVENT_CLOSED,
    EVENT_CONVERTED,
    EVENT_ERROR,
    EVENT_ESCALATION,
    EVENT_STEP_CHANGE,
    JOB_GENERATE_REPLY,
    JOB_INBOUND_MESSAGE,
    JOB_SEND_MESSAGE,
    JOB_START_CONVERSATION,
    JOB_WARMUP_TICK,
    SEND_DELAY_MAX_SEC,
    SEND_DELAY_MIN_SEC,
    STATE_BOT,
    STATE_CLOSED,
    STATE_HANDOFF,
    TG_STATUS_ACTIVE,
    TG_STATUS_WARMUP,
    WARMUP_DAILY_LIMITS,
)
from agent_shared.schemas import (
    GenerateReplyJob,
    InboundMessageJob,
    SendMessageJob,
    StartConversationJob,
)
from app.config import get_settings
from app.db import SessionLocal
from app.models import Agent, Conversation, Lead, Message, Script, TelegramAccount
from app.queue import enqueue
from app.redis_client import RateLimiter, get_redis, publish_ws
from app.services import add_event, bump_script_metrics, bump_usage
from llm import build_messages, call_llm
from state_machine import get_step, initial_step, resolve_next_step

logger = logging.getLogger("runner")
logging.basicConfig(level=logging.INFO)


async def inbound_message(ctx: dict, **kwargs) -> None:
    job = InboundMessageJob.model_validate(kwargs)
    async with SessionLocal() as db:
        conv: Conversation | None = None
        if job.conversation_id:
            conv = await db.get(Conversation, UUID(job.conversation_id))
        if not conv and job.lead_telegram_id:
            lead = (
                await db.execute(
                    select(Lead).where(
                        Lead.tenant_id == UUID(job.tenant_id),
                        Lead.telegram_id == job.lead_telegram_id,
                    )
                )
            ).scalar_one_or_none()
            if lead:
                conv = (
                    await db.execute(
                        select(Conversation)
                        .where(
                            Conversation.lead_id == lead.id,
                            Conversation.state.in_([STATE_BOT, STATE_HANDOFF]),
                        )
                        .order_by(Conversation.created_at.desc())
                    )
                ).scalars().first()

        if not conv:
            logger.warning("No conversation for inbound: %s", job)
            return

        msg = Message(
            tenant_id=conv.tenant_id,
            conversation_id=conv.id,
            direction=DIR_IN,
            text=job.text,
            tokens_used=0,
            source="lead",
            telegram_message_id=job.telegram_message_id,
        )
        conv.last_message_at = datetime.now(timezone.utc)
        db.add(msg)
        await db.commit()

        await publish_ws(
            str(conv.tenant_id),
            {
                "type": "message",
                "tenant_id": str(conv.tenant_id),
                "conversation_id": str(conv.id),
                "payload": {"direction": "in", "text": job.text},
            },
        )

        if conv.state == STATE_BOT:
            await enqueue(
                JOB_GENERATE_REPLY,
                **GenerateReplyJob(
                    tenant_id=str(conv.tenant_id),
                    conversation_id=str(conv.id),
                    trigger="inbound",
                ).model_dump(),
            )


async def start_conversation(ctx: dict, **kwargs) -> None:
    job = StartConversationJob.model_validate(kwargs)
    await enqueue(
        JOB_GENERATE_REPLY,
        **GenerateReplyJob(
            tenant_id=job.tenant_id,
            conversation_id=job.conversation_id or "",
            trigger="start",
        ).model_dump(),
    )


async def generate_reply(ctx: dict, **kwargs) -> None:
    job = GenerateReplyJob.model_validate(kwargs)
    async with SessionLocal() as db:
        conv = await db.get(Conversation, UUID(job.conversation_id))
        if not conv or str(conv.tenant_id) != job.tenant_id:
            return
        if conv.state != STATE_BOT:
            logger.info("Skip generate_reply, state=%s", conv.state)
            return

        agent = await db.get(Agent, conv.agent_id)
        lead = await db.get(Lead, conv.lead_id)
        script = await db.get(Script, conv.script_id) if conv.script_id else None
        if not agent or not lead or not script or not agent.telegram_account_id:
            await add_event(db, conv.tenant_id, conv.id, EVENT_ERROR, {"error": "missing_refs"})
            await db.commit()
            return

        history_rows = (
            await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.created_at.asc())
                .limit(40)
            )
        ).scalars().all()

        history: list[dict[str, str]] = []
        for m in history_rows:
            role = "assistant" if m.direction == DIR_OUT else "user"
            history.append({"role": role, "content": m.text})

        if job.trigger == "start" and not history:
            history = [{"role": "user", "content": "Начни диалог. Это первое сообщение лиду."}]

        steps = script.steps_json or {}
        if job.trigger == "start" and (not conv.current_step or conv.current_step == "start"):
            conv.current_step = initial_step(steps)

        step = get_step(steps, conv.current_step)
        system, hist = build_messages(
            script.system_prompt,
            step,
            history,
            lead.custom_fields_json or {},
            conv.current_step,
        )

        try:
            reply, tokens = await call_llm(
                model=agent.llm_model,
                temperature=agent.temperature,
                system=system,
                history=hist,
            )
        except Exception as e:
            logger.exception("LLM error")
            await add_event(db, conv.tenant_id, conv.id, EVENT_ERROR, {"error": str(e)})
            await db.commit()
            return

        if reply.needs_human:
            conv.state = STATE_HANDOFF
            await add_event(db, conv.tenant_id, conv.id, EVENT_ESCALATION, {"reason": "llm"})
            if conv.script_id and conv.script_version:
                await bump_script_metrics(
                    db, conv.tenant_id, conv.script_id, conv.script_version, handoffs=1
                )
            await bump_usage(db, conv.tenant_id, tokens=tokens)
            await db.commit()
            await publish_ws(
                str(conv.tenant_id),
                {"type": "handoff", "tenant_id": str(conv.tenant_id), "conversation_id": str(conv.id)},
            )
            return

        new_step = resolve_next_step(steps, conv.current_step, reply.next_step)
        if new_step != conv.current_step:
            await add_event(
                db,
                conv.tenant_id,
                conv.id,
                EVENT_STEP_CHANGE,
                {"from": conv.current_step, "to": new_step},
            )
            conv.current_step = new_step

        if reply.converted:
            conv.converted = True
            await add_event(db, conv.tenant_id, conv.id, EVENT_CONVERTED, {})
            if conv.script_id and conv.script_version:
                await bump_script_metrics(
                    db, conv.tenant_id, conv.script_id, conv.script_version, converted=1
                )
            await bump_usage(db, conv.tenant_id, conversions=1)
            lead.status = "converted"

        if reply.closed:
            conv.state = STATE_CLOSED
            await add_event(db, conv.tenant_id, conv.id, EVENT_CLOSED, {})
            if conv.script_id and conv.script_version:
                await bump_script_metrics(
                    db, conv.tenant_id, conv.script_id, conv.script_version, closed=1
                )
            lead.status = "closed"

        out = Message(
            tenant_id=conv.tenant_id,
            conversation_id=conv.id,
            direction=DIR_OUT,
            text=reply.text,
            tokens_used=tokens,
            source="bot",
        )
        conv.last_message_at = datetime.now(timezone.utc)
        db.add(out)
        await bump_usage(db, conv.tenant_id, tokens=tokens)
        await db.commit()
        await db.refresh(out)

        delay = random.randint(SEND_DELAY_MIN_SEC, SEND_DELAY_MAX_SEC)
        send_job = SendMessageJob(
            tenant_id=str(conv.tenant_id),
            conversation_id=str(conv.id),
            telegram_account_id=str(agent.telegram_account_id),
            lead_telegram_id=lead.telegram_id,
            lead_username=lead.telegram_username,
            text=reply.text,
            message_id=str(out.id),
            show_typing=True,
        )
        arq = ctx["redis"]
        await arq.enqueue_job(JOB_SEND_MESSAGE, _defer_by=delay, **send_job.model_dump())

        await publish_ws(
            str(conv.tenant_id),
            {
                "type": "message",
                "tenant_id": str(conv.tenant_id),
                "conversation_id": str(conv.id),
                "payload": {"direction": "out", "text": reply.text, "source": "bot", "deferred_sec": delay},
            },
        )


async def send_message(ctx: dict, **kwargs) -> None:
    """Rate-limit gate; actual Telethon send is done by gateway via Redis list."""
    job = SendMessageJob.model_validate(kwargs)
    r = await get_redis()
    async with SessionLocal() as db:
        account = await db.get(TelegramAccount, UUID(job.telegram_account_id))
        if not account or not account.session_encrypted:
            logger.error("No session for account %s", job.telegram_account_id)
            return
        if account.status in ("banned", "limited"):
            logger.warning("Account %s status=%s, skip send", account.id, account.status)
            return

        limiter = RateLimiter(r)
        ok, reason = await limiter.can_send(
            str(account.id), account.daily_limit, account.warmup_stage
        )
        if not ok:
            logger.info("Rate limited %s: %s — requeue in 5m", account.id, reason)
            arq = ctx["redis"]
            await arq.enqueue_job(JOB_SEND_MESSAGE, _defer_by=300, **job.model_dump())
            return

        # Push to gateway outbound queue
        import json

        await r.lpush("gateway:outbound", json.dumps(job.model_dump(), default=str))
        await limiter.record_send(str(account.id))
        account.sent_today = (account.sent_today or 0) + 1
        await bump_usage(db, UUID(job.tenant_id), messages_out=1)
        await db.commit()


async def warmup_tick(ctx: dict) -> None:
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(TelegramAccount).where(
                    TelegramAccount.status.in_([TG_STATUS_WARMUP, TG_STATUS_ACTIVE])
                )
            )
        ).scalars().all()
        for acc in rows:
            if acc.status == TG_STATUS_WARMUP and acc.warmup_stage < max(WARMUP_DAILY_LIMITS):
                acc.warmup_stage += 1
                acc.daily_limit = WARMUP_DAILY_LIMITS.get(acc.warmup_stage, acc.daily_limit)
                if acc.warmup_stage >= 5:
                    acc.status = TG_STATUS_ACTIVE
            acc.sent_today = 0
        await db.commit()
        logger.info("Warmup tick processed %s accounts", len(rows))


async def startup(ctx: dict) -> None:
    logger.info("Runner started")


class WorkerSettings:
    functions = [
        inbound_message,
        generate_reply,
        send_message,
        start_conversation,
        warmup_tick,
    ]
    cron_jobs = [cron(warmup_tick, hour=4, minute=0)]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = 20
