from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession

from agent_shared.constants import TG_STATUS_WARMUP, WARMUP_DAILY_LIMITS
from app.auth import ServiceAuth, TenantId
from app.config import get_settings
from app.crypto import encrypt_session
from app.db import get_db
from app.models import TelegramAccount, TelegramLoginSession
from app.schemas import (
    TelegramLoginConfirmRequest,
    TelegramLoginConfirmResponse,
    TelegramLoginStartRequest,
    TelegramLoginStartResponse,
)

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/login/start", response_model=TelegramLoginStartResponse)
async def login_start(
    body: TelegramLoginStartRequest,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> TelegramLoginStartResponse:
    settings = get_settings()
    if not settings.telegram_api_id or not settings.telegram_api_hash:
        raise HTTPException(400, "TELEGRAM_API_ID / TELEGRAM_API_HASH not configured")

    account = await db.get(TelegramAccount, body.telegram_account_id)
    if not account or account.tenant_id != tenant_id:
        raise HTTPException(404, "Telegram account not found")

    client = TelegramClient(StringSession(), settings.telegram_api_id, settings.telegram_api_hash)
    await client.connect()
    try:
        result = await client.send_code_request(body.phone)
        session_str = client.session.save()
        login = TelegramLoginSession(
            tenant_id=tenant_id,
            telegram_account_id=account.id,
            phone=body.phone,
            phone_code_hash=result.phone_code_hash,
            session_string=session_str,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        account.phone = body.phone
        db.add(login)
        await db.commit()
        await db.refresh(login)
        return TelegramLoginStartResponse(login_session_id=login.id)
    finally:
        await client.disconnect()


@router.post("/login/confirm", response_model=TelegramLoginConfirmResponse)
async def login_confirm(
    body: TelegramLoginConfirmRequest,
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> TelegramLoginConfirmResponse:
    settings = get_settings()
    login = await db.get(TelegramLoginSession, body.login_session_id)
    if not login or login.tenant_id != tenant_id:
        raise HTTPException(404, "Login session not found")
    if login.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(400, "Login session expired")

    account = await db.get(TelegramAccount, login.telegram_account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    client = TelegramClient(
        StringSession(login.session_string or ""),
        settings.telegram_api_id,
        settings.telegram_api_hash,
    )
    await client.connect()
    try:
        try:
            await client.sign_in(login.phone, body.code, phone_code_hash=login.phone_code_hash)
        except SessionPasswordNeededError:
            if not body.password:
                raise HTTPException(400, "2FA password required") from None
            await client.sign_in(password=body.password)

        session_str = client.session.save()
        account.session_encrypted = encrypt_session(session_str)
        account.status = TG_STATUS_WARMUP
        account.warmup_stage = 0
        account.daily_limit = WARMUP_DAILY_LIMITS[0]
        account.phone = login.phone
        await db.delete(login)
        await db.commit()
        return TelegramLoginConfirmResponse(telegram_account_id=account.id, status=account.status)
    finally:
        await client.disconnect()


@router.get("/accounts")
async def list_accounts(
    _: ServiceAuth,
    tenant_id: TenantId,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    rows = (
        await db.execute(select(TelegramAccount).where(TelegramAccount.tenant_id == tenant_id))
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "phone": r.phone,
            "status": r.status,
            "daily_limit": r.daily_limit,
            "sent_today": r.sent_today,
            "warmup_stage": r.warmup_stage,
            "has_session": bool(r.session_encrypted),
        }
        for r in rows
    ]
