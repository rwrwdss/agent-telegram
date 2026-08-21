from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

from agent_shared.constants import HOURLY_LIMIT_RATIO, WS_CHANNEL_PREFIX, WARMUP_DAILY_LIMITS
from app.config import get_settings

_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(get_settings().redis_url, decode_responses=True)
    return _pool


async def publish_ws(tenant_id: str, event: dict[str, Any]) -> None:
    r = await get_redis()
    await r.publish(f"{WS_CHANNEL_PREFIX}{tenant_id}", json.dumps(event, default=str))


class RateLimiter:
    """Token-bucket style limits per telegram account (hour + day)."""

    def __init__(self, r: redis.Redis):
        self.r = r

    def _hour_key(self, account_id: str) -> str:
        return f"rl:hour:{account_id}"

    def _day_key(self, account_id: str) -> str:
        return f"rl:day:{account_id}"

    async def can_send(self, account_id: str, daily_limit: int, warmup_stage: int) -> tuple[bool, str]:
        effective_daily = min(daily_limit, WARMUP_DAILY_LIMITS.get(warmup_stage, daily_limit))
        hourly = max(1, int(effective_daily * HOURLY_LIMIT_RATIO))

        day_count = int(await self.r.get(self._day_key(account_id)) or 0)
        hour_count = int(await self.r.get(self._hour_key(account_id)) or 0)

        if day_count >= effective_daily:
            return False, f"daily_limit_reached:{effective_daily}"
        if hour_count >= hourly:
            return False, f"hourly_limit_reached:{hourly}"
        return True, "ok"

    async def record_send(self, account_id: str) -> None:
        day_key = self._day_key(account_id)
        hour_key = self._hour_key(account_id)
        pipe = self.r.pipeline()
        pipe.incr(day_key)
        pipe.expire(day_key, 86400)
        pipe.incr(hour_key)
        pipe.expire(hour_key, 3600)
        await pipe.execute()

    async def get_counts(self, account_id: str) -> dict[str, int]:
        return {
            "sent_hour": int(await self.r.get(self._hour_key(account_id)) or 0),
            "sent_day": int(await self.r.get(self._day_key(account_id)) or 0),
        }
