"""Shared stale-while-revalidate cache for public RAWG payloads."""

import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx


@dataclass(frozen=True)
class CachedPayload:
    value: Any
    is_fresh: bool


class UpstashGameGroupCache:
    """Persist provider-native group data and coordinate distributed refreshes."""

    _KEY_PREFIX = "gamingclock:game-groups:v3:"

    def __init__(self, url: str, token: str, http_client: httpx.AsyncClient | None = None) -> None:
        self._url = url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._http_client = http_client or httpx.AsyncClient(timeout=0.25)
        self._owns_http_client = http_client is None

    @classmethod
    def from_environment(cls) -> UpstashGameGroupCache | None:
        url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
        return cls(url, token) if url and token else None

    async def get(self, key: str) -> CachedPayload | None:
        response = await self._http_client.get(
            f"{self._url}/get/{quote(self._key(key), safe='')}", headers=self._headers
        )
        response.raise_for_status()
        encoded = response.json().get("result")
        if encoded is None:
            return None
        envelope = json.loads(encoded)
        if not isinstance(envelope, dict) or "value" not in envelope:
            return None
        fresh_until = envelope.get("fresh_until")
        if not isinstance(fresh_until, (int, float)):
            return None
        return CachedPayload(value=envelope["value"], is_fresh=fresh_until > time.time())

    async def set(self, key: str, value: Any, *, fresh_seconds: int, stale_seconds: int = 0) -> None:
        fresh_seconds = max(fresh_seconds, 1)
        stale_seconds = max(stale_seconds, 0)
        envelope = {"value": value, "fresh_until": time.time() + fresh_seconds}
        response = await self._http_client.post(
            self._url,
            headers=self._headers,
            json=["SET", self._key(key), json.dumps(envelope), "EX", fresh_seconds + stale_seconds],
        )
        response.raise_for_status()

    async def try_acquire_refresh_lock(self, key: str, *, seconds: int = 30) -> bool:
        response = await self._http_client.post(
            self._url,
            headers=self._headers,
            json=["SET", self._key(f"lock:{key}"), "1", "NX", "EX", max(seconds, 1)],
        )
        response.raise_for_status()
        return response.json().get("result") == "OK"

    async def aclose(self) -> None:
        if self._owns_http_client:
            await self._http_client.aclose()

    def _key(self, key: str) -> str:
        return f"{self._KEY_PREFIX}{key}"
