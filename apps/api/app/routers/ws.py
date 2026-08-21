from __future__ import annotations

import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from agent_shared.constants import WS_CHANNEL_PREFIX
from app.config import get_settings
from app.redis_client import get_redis

router = APIRouter(tags=["ws"])


@router.websocket("/ws/tenants/{tenant_id}/conversations")
async def conversations_ws(websocket: WebSocket, tenant_id: UUID) -> None:
    token = websocket.query_params.get("token")
    if token != get_settings().service_token:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    r = await get_redis()
    pubsub = r.pubsub()
    channel = f"{WS_CHANNEL_PREFIX}{tenant_id}"
    await pubsub.subscribe(channel)

    async def reader() -> None:
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg.get("data"):
                data = msg["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data if isinstance(data, str) else json.dumps(data))
            else:
                await asyncio.sleep(0.05)

    task = asyncio.create_task(reader())
    try:
        while True:
            # keep alive / allow client pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
