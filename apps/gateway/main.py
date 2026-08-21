from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))
sys.path.insert(0, str(ROOT / "packages" / "shared"))

from sqlalchemy import select
from telethon import TelegramClient, events
from telethon.errors import FloodWaitError, UserDeactivatedBanError
from telethon.sessions import StringSession
from telethon.tl.functions.messages import SetTypingRequest
from telethon.tl.types import SendMessageTypingAction

from agent_shared.constants import (
    JOB_INBOUND_MESSAGE,
    TG_STATUS_ACTIVE,
    TG_STATUS_BANNED,
    TG_STATUS_LIMITED,
    TG_STATUS_WARMUP,
)
from agent_shared.schemas import InboundMessageJob, SendMessageJob
from app.config import get_settings
from app.crypto import decrypt_session
from app.db import SessionLocal
from app.models import Conversation, Lead, TelegramAccount
from app.queue import enqueue
from app.redis_client import get_redis

logger = logging.getLogger("gateway")
logging.basicConfig(level=logging.INFO)


class AccountWorker:
    def __init__(self, account: TelegramAccount):
        self.account = account
        self.client: TelegramClient | None = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        settings = get_settings()
        session = decrypt_session(self.account.session_encrypted or "")
        self.client = TelegramClient(
            StringSession(session),
            settings.telegram_api_id,
            settings.telegram_api_hash,
        )
        await self.client.connect()
        if not await self.client.is_user_authorized():
            logger.error("Account %s not authorized", self.account.id)
            return

        @self.client.on(events.NewMessage(incoming=True))
        async def on_message(event: events.NewMessage.Event) -> None:
            if event.out:
                return
            sender = await event.get_sender()
            tg_id = getattr(sender, "id", None)
            username = getattr(sender, "username", None)
            text = event.raw_text or ""
            conv_id = await self._find_conversation(tg_id, username)
            job = InboundMessageJob(
                tenant_id=str(self.account.tenant_id),
                telegram_account_id=str(self.account.id),
                conversation_id=str(conv_id) if conv_id else None,
                lead_telegram_id=tg_id,
                lead_username=username,
                text=text,
                telegram_message_id=event.id,
            )
            await enqueue(JOB_INBOUND_MESSAGE, **job.model_dump(mode="json"))

        logger.info("Listening account %s (%s)", self.account.id, self.account.phone)
        self._task = asyncio.create_task(self.client.run_until_disconnected())

    async def _find_conversation(self, tg_id: int | None, username: str | None) -> UUID | None:
        async with SessionLocal() as db:
            q = select(Lead).where(Lead.tenant_id == self.account.tenant_id)
            if tg_id:
                lead = (await db.execute(q.where(Lead.telegram_id == tg_id))).scalar_one_or_none()
            elif username:
                lead = (
                    await db.execute(q.where(Lead.telegram_username == username))
                ).scalar_one_or_none()
            else:
                return None
            if not lead:
                return None
            conv = (
                await db.execute(
                    select(Conversation)
                    .where(Conversation.lead_id == lead.id)
                    .order_by(Conversation.created_at.desc())
                )
            ).scalars().first()
            return conv.id if conv else None

    async def send(self, job: SendMessageJob) -> None:
        if not self.client:
            return
        try:
            entity = job.lead_telegram_id or job.lead_username
            if not entity:
                logger.error("No lead target for send")
                return
            if job.show_typing:
                try:
                    peer = await self.client.get_input_entity(entity)
                    await self.client(SetTypingRequest(peer, SendMessageTypingAction()))
                    await asyncio.sleep(1.5)
                except Exception:
                    pass
            await self.client.send_message(entity, job.text)
            logger.info("Sent via %s to %s", self.account.id, entity)
        except FloodWaitError as e:
            logger.warning("FloodWait %s sec on %s", e.seconds, self.account.id)
            async with SessionLocal() as db:
                acc = await db.get(TelegramAccount, self.account.id)
                if acc:
                    acc.status = TG_STATUS_LIMITED
                    await db.commit()
            raise
        except UserDeactivatedBanError:
            async with SessionLocal() as db:
                acc = await db.get(TelegramAccount, self.account.id)
                if acc:
                    acc.status = TG_STATUS_BANNED
                    await db.commit()
            raise

    async def stop(self) -> None:
        if self.client:
            await self.client.disconnect()


class Gateway:
    def __init__(self) -> None:
        self.workers: dict[str, AccountWorker] = {}

    async def refresh_accounts(self) -> None:
        async with SessionLocal() as db:
            rows = (
                await db.execute(
                    select(TelegramAccount).where(
                        TelegramAccount.status.in_([TG_STATUS_WARMUP, TG_STATUS_ACTIVE, TG_STATUS_LIMITED]),
                        TelegramAccount.session_encrypted.isnot(None),
                    )
                )
            ).scalars().all()

        known = set(self.workers.keys())
        current = {str(r.id) for r in rows}
        for dead in known - current:
            await self.workers[dead].stop()
            del self.workers[dead]

        for row in rows:
            aid = str(row.id)
            if aid not in self.workers:
                w = AccountWorker(row)
                try:
                    await w.start()
                    self.workers[aid] = w
                except Exception:
                    logger.exception("Failed to start account %s", aid)

    async def outbound_loop(self) -> None:
        r = await get_redis()
        while True:
            item = await r.brpop("gateway:outbound", timeout=2)
            if not item:
                continue
            _, raw = item
            try:
                job = SendMessageJob.model_validate_json(raw)
            except Exception:
                logger.exception("Bad outbound payload")
                continue
            worker = self.workers.get(job.telegram_account_id)
            if not worker:
                # try refresh once
                await self.refresh_accounts()
                worker = self.workers.get(job.telegram_account_id)
            if not worker:
                logger.error("No worker for account %s, requeue", job.telegram_account_id)
                await r.lpush("gateway:outbound", raw)
                await asyncio.sleep(5)
                continue
            try:
                await worker.send(job)
            except FloodWaitError as e:
                await asyncio.sleep(min(e.seconds, 300))
                await r.lpush("gateway:outbound", raw)
            except Exception:
                logger.exception("Send failed")

    async def watch_loop(self) -> None:
        while True:
            try:
                await self.refresh_accounts()
            except Exception:
                logger.exception("refresh failed")
            await asyncio.sleep(30)

    async def run(self) -> None:
        settings = get_settings()
        if not settings.telegram_api_id:
            logger.warning("TELEGRAM_API_ID not set — gateway idle")
        await asyncio.gather(self.watch_loop(), self.outbound_loop())


async def main() -> None:
    gw = Gateway()
    await gw.run()


if __name__ == "__main__":
    asyncio.run(main())
