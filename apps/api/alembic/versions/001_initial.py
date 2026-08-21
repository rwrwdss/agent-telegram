"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-08-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(64), server_default="starter"),
        sa.Column("limits", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "app_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(64), server_default="admin"),
        sa.Column("payload_user_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_app_users_tenant_id", "app_users", ["tenant_id"])

    op.create_table(
        "telegram_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("session_encrypted", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("daily_limit", sa.Integer(), server_default="5"),
        sa.Column("sent_today", sa.Integer(), server_default="0"),
        sa.Column("sent_reset_date", sa.Date(), nullable=True),
        sa.Column("warmup_stage", sa.Integer(), server_default="0"),
        sa.Column("payload_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_telegram_accounts_tenant_id", "telegram_accounts", ["tenant_id"])
    op.create_index("ix_telegram_accounts_payload_id", "telegram_accounts", ["payload_id"])

    op.create_table(
        "scripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(32), server_default="1"),
        sa.Column("system_prompt", sa.Text(), server_default=""),
        sa.Column("steps_json", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("fallback_rules", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("payload_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_scripts_tenant_id", "scripts", ["tenant_id"])
    op.create_index("ix_scripts_payload_id", "scripts", ["payload_id"])

    op.create_table(
        "agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("telegram_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("telegram_accounts.id"), nullable=True),
        sa.Column("script_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scripts.id"), nullable=True),
        sa.Column("llm_model", sa.String(128), server_default="gpt-4o-mini"),
        sa.Column("temperature", sa.Float(), server_default="0.7"),
        sa.Column("status", sa.String(32), server_default="active"),
        sa.Column("payload_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_agents_tenant_id", "agents", ["tenant_id"])
    op.create_index("ix_agents_payload_id", "agents", ["payload_id"])

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("telegram_username", sa.String(255), nullable=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=True),
        sa.Column("source", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), server_default="new"),
        sa.Column("custom_fields_json", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("payload_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_leads_tenant_id", "leads", ["tenant_id"])
    op.create_index("ix_leads_telegram_id", "leads", ["telegram_id"])
    op.create_index("ix_leads_payload_id", "leads", ["payload_id"])

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("script_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scripts.id"), nullable=True),
        sa.Column("script_version", sa.String(32), nullable=True),
        sa.Column("current_step", sa.String(128), server_default="start"),
        sa.Column("state", sa.String(32), server_default="bot"),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload_id", sa.String(64), nullable=True),
        sa.Column("converted", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_conversations_tenant_id", "conversations", ["tenant_id"])
    op.create_index("ix_conversations_lead_id", "conversations", ["lead_id"])
    op.create_index("ix_conversations_agent_id", "conversations", ["agent_id"])
    op.create_index("ix_conversations_payload_id", "conversations", ["payload_id"])

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("tokens_used", sa.Integer(), server_default="0"),
        sa.Column("source", sa.String(32), server_default="bot"),
        sa.Column("telegram_message_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_messages_tenant_id", "messages", ["tenant_id"])
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_events_tenant_id", "events", ["tenant_id"])
    op.create_index("ix_events_conversation_id", "events", ["conversation_id"])

    op.create_table(
        "usage_daily",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("tokens_total", sa.Integer(), server_default="0"),
        sa.Column("messages_out", sa.Integer(), server_default="0"),
        sa.Column("conversations_started", sa.Integer(), server_default="0"),
        sa.Column("conversions", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("tenant_id", "day", name="uq_usage_tenant_day"),
    )
    op.create_index("ix_usage_daily_tenant_id", "usage_daily", ["tenant_id"])

    op.create_table(
        "script_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("script_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scripts.id"), nullable=False),
        sa.Column("script_version", sa.String(32), nullable=False),
        sa.Column("started", sa.Integer(), server_default="0"),
        sa.Column("converted", sa.Integer(), server_default="0"),
        sa.Column("closed", sa.Integer(), server_default="0"),
        sa.Column("handoffs", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("tenant_id", "script_id", "script_version", name="uq_script_metrics"),
    )
    op.create_index("ix_script_metrics_tenant_id", "script_metrics", ["tenant_id"])
    op.create_index("ix_script_metrics_script_id", "script_metrics", ["script_id"])

    op.create_table(
        "telegram_login_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("telegram_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("telegram_accounts.id"), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("phone_code_hash", sa.Text(), nullable=False),
        sa.Column("session_string", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_telegram_login_sessions_tenant_id", "telegram_login_sessions", ["tenant_id"])
    op.create_index("ix_telegram_login_sessions_telegram_account_id", "telegram_login_sessions", ["telegram_account_id"])


def downgrade() -> None:
    for table in [
        "telegram_login_sessions",
        "script_metrics",
        "usage_daily",
        "events",
        "messages",
        "conversations",
        "leads",
        "agents",
        "scripts",
        "telegram_accounts",
        "app_users",
        "tenants",
    ]:
        op.drop_table(table)
