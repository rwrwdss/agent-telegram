#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"
export PYTHONPATH=.
alembic upgrade head
echo "Migrations applied."
