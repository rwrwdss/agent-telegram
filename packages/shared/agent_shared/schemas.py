from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class InboundMessageJob(BaseModel):
    tenant_id: str
    telegram_account_id: str
    conversation_id: str | None = None
    lead_telegram_id: int | None = None
    lead_username: str | None = None
    text: str
    telegram_message_id: int | None = None
    received_at: datetime = Field(default_factory=datetime.utcnow)


class GenerateReplyJob(BaseModel):
    tenant_id: str
    conversation_id: str
    trigger: Literal["inbound", "start", "resume"] = "inbound"


class SendMessageJob(BaseModel):
    tenant_id: str
    conversation_id: str
    telegram_account_id: str
    lead_telegram_id: int | None = None
    lead_username: str | None = None
    text: str
    message_id: str | None = None  # DB message row id after insert
    show_typing: bool = True


class StartConversationJob(BaseModel):
    tenant_id: str
    agent_id: str
    lead_id: str
    conversation_id: str | None = None


class WarmupTickJob(BaseModel):
    telegram_account_id: str | None = None  # None = all accounts


class LLMReply(BaseModel):
    text: str
    next_step: str | None = None
    needs_human: bool = False
    converted: bool = False
    closed: bool = False


class WsEvent(BaseModel):
    type: str
    tenant_id: str
    conversation_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
