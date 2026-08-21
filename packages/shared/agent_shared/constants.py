"""Shared constants and task names for agent runtime."""

from __future__ import annotations

# arq job names
JOB_INBOUND_MESSAGE = "inbound_message"
JOB_GENERATE_REPLY = "generate_reply"
JOB_SEND_MESSAGE = "send_message"
JOB_START_CONVERSATION = "start_conversation"
JOB_WARMUP_TICK = "warmup_tick"

# Conversation states
STATE_BOT = "bot"
STATE_HANDOFF = "handoff_human"
STATE_CLOSED = "closed"

# Message directions
DIR_IN = "in"
DIR_OUT = "out"

# Event types
EVENT_STEP_CHANGE = "step_change"
EVENT_ESCALATION = "escalation"
EVENT_ERROR = "error"
EVENT_CONVERTED = "converted"
EVENT_CLOSED = "closed"
EVENT_STARTED = "started"

# Telegram account statuses
TG_STATUS_PENDING = "pending"
TG_STATUS_WARMUP = "warmup"
TG_STATUS_ACTIVE = "active"
TG_STATUS_LIMITED = "limited"
TG_STATUS_BANNED = "banned"

# Redis channels
WS_CHANNEL_PREFIX = "ws:tenant:"

# Warmup: stage -> daily message limit
WARMUP_DAILY_LIMITS = {
    0: 5,
    1: 15,
    2: 30,
    3: 50,
    4: 80,
    5: 120,
}

HOURLY_LIMIT_RATIO = 0.25  # max 25% of daily limit per hour
SEND_DELAY_MIN_SEC = 5
SEND_DELAY_MAX_SEC = 40
