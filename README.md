# AI Telegram Agents

Мультитенантная система холодной переписки в Telegram (MTProto / Telethon) с админкой на Payload CMS (Next.js) и runtime на FastAPI + arq + Redis.

## Архитектура

- **apps/cms** — Payload CMS 3 (CRUD тенантов, агентов, скриптов, лидов, TG-аккаунтов) + кастомные экраны (логин TG, live-диалоги, кампании, метрики)
- **apps/api** — FastAPI: login TG, кампании, handoff, WS, sync из Payload, метрики
- **apps/runner** — arq worker: сценарии, LLM, delayed send, warmup
- **apps/gateway** — Telethon: входящие/исходящие, изоляция аккаунтов
- **packages/shared** — константы и pydantic-схемы задач

## Быстрый старт

```bash
cp .env.example .env
# заполните TELEGRAM_API_ID, TELEGRAM_API_HASH, OPENAI_API_KEY / ANTHROPIC_API_KEY

docker compose up -d postgres redis
# Postgres на хосте: localhost:5434 (чтобы не конфликтовать с локальным PG)

# API + миграции
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -e ../../packages/shared
export PYTHONPATH=.
set -a && source ../../.env && set +a
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Runner (другой терминал)
cd apps/runner
export PYTHONPATH=../api:../../packages/shared:.
arq worker.WorkerSettings

# Gateway
cd apps/gateway
export PYTHONPATH=../api:../../packages/shared:.
python main.py

# CMS
cd apps/cms
npm install
npm run dev
```

Откройте http://localhost:3000/admin — создайте первого пользователя.

## Поток работы

1. Superadmin создаёт Tenant и User (role=admin, привязка к tenant).
2. Admin создаёт Telegram Account → Script → Agent → Leads (автосинк в runtime через `/sync`).
3. `/ops/connect-telegram` — phone + код → encrypted session.
4. `/ops/campaigns` — старт диалогов (runtime UUID агента и лидов).
5. `/ops/live` — мониторинг, handoff, ответ оператора.
6. `/ops/metrics` — токены и conversion rate по версиям скриптов.

В кастомных экранах в поле Tenant укажите **Payload ID тенанта** (число, напр. `1`) — API сам смапит его в стабильный UUID.

## Заголовки API

Все runtime-эндпоинты требуют:

- `X-Service-Token: <SERVICE_TOKEN>`
- `X-Tenant-Id: <uuid>`

## Важно

Userbot/холодная переписка может нарушать ToS Telegram — используйте троттлинг и warmup, не спамьте.
