from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TelegramLoginStartRequest(BaseModel):
    telegram_account_id: UUID
    phone: str


class TelegramLoginStartResponse(BaseModel):
    login_session_id: UUID
    message: str = "code_sent"


class TelegramLoginConfirmRequest(BaseModel):
    login_session_id: UUID
    code: str
    password: str | None = None  # 2FA


class TelegramLoginConfirmResponse(BaseModel):
    telegram_account_id: UUID
    status: str


class CampaignStartRequest(BaseModel):
    agent_id: UUID
    lead_ids: list[UUID] = Field(min_length=1)


class CampaignStartResponse(BaseModel):
    conversation_ids: list[UUID]
    enqueued: int


class OperatorMessageRequest(BaseModel):
    text: str


class SyncEntityRequest(BaseModel):
    """Upsert Payload collection docs into runtime tables."""

    entity: str
    payload_id: str
    data: dict[str, Any]


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    direction: str
    text: str
    tokens_used: int
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EventOut(BaseModel):
    id: UUID
    conversation_id: UUID
    type: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: UUID
    tenant_id: UUID
    lead_id: UUID
    agent_id: UUID
    current_step: str
    state: str
    script_version: str | None
    last_message_at: datetime | None
    converted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UsageDailyOut(BaseModel):
    day: datetime | Any
    tokens_total: int
    messages_out: int
    conversations_started: int
    conversions: int

    model_config = {"from_attributes": True}


class ScriptMetricsOut(BaseModel):
    script_id: UUID
    script_version: str
    started: int
    converted: int
    closed: int
    handoffs: int
    conversion_rate: float

    model_config = {"from_attributes": True}
