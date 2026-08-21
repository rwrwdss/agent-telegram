from __future__ import annotations

from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config import get_settings

_arq: ArqRedis | None = None


def _redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(get_settings().redis_url)


async def get_arq() -> ArqRedis:
    global _arq
    if _arq is None:
        _arq = await create_pool(_redis_settings())
    return _arq


async def enqueue(job_name: str, **kwargs: Any) -> str:
    arq = await get_arq()
    job = await arq.enqueue_job(job_name, **kwargs)
    return job.job_id if job else ""
