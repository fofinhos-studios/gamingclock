import json

import httpx
import pytest

from gamingclock.services.game_group_cache import UpstashGameGroupCache


@pytest.mark.asyncio
async def test_cache_stores_fresh_and_stale_windows_in_a_versioned_rawg_key():
    commands: list[list[object]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        commands.append(json.loads(request.content))
        return httpx.Response(200, json={"result": "OK"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    cache = UpstashGameGroupCache(url="https://example.com", token="token", http_client=client)
    await cache.set("rawg:search:final fantasy", [{"id": 1}], fresh_seconds=10, stale_seconds=20)

    command = commands[0]
    assert command[1] == "gamingclock:game-groups:v3:rawg:search:final fantasy"
    assert command[-1] == 30
    assert isinstance(command[2], str)
    assert json.loads(command[2])["value"] == [{"id": 1}]
    await client.aclose()


@pytest.mark.asyncio
async def test_refresh_lock_uses_redis_nx():
    commands: list[list[object]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        commands.append(json.loads(request.content))
        return httpx.Response(200, json={"result": "OK"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    cache = UpstashGameGroupCache(url="https://example.com", token="token", http_client=client)

    assert await cache.try_acquire_refresh_lock("rawg:group:1")
    assert commands[0][0:5] == ["SET", "gamingclock:game-groups:v3:lock:rawg:group:1", "1", "NX", "EX"]
    await client.aclose()
