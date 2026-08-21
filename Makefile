.PHONY: up down migrate api runner gateway cms

up:
	docker compose up -d postgres redis

down:
	docker compose down

migrate:
	cd apps/api && . .venv/bin/activate && set -a && source ../../.env && set +a && PYTHONPATH=. alembic upgrade head

api:
	cd apps/api && . .venv/bin/activate && set -a && source ../../.env && set +a && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

runner:
	cd apps/runner && . ../api/.venv/bin/activate && set -a && source ../../.env && set +a && PYTHONPATH=../api:../../packages/shared:. arq worker.WorkerSettings

gateway:
	cd apps/gateway && . ../api/.venv/bin/activate && set -a && source ../../.env && set +a && PYTHONPATH=../api:../../packages/shared:. python main.py

cms:
	cd apps/cms && set -a && source ../../.env && set +a && npm run dev
