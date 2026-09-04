"""Shared, long-lived cache for provider-native game group results."""

import json
import os
from typing import Any
from urllib.parse import quote

import httpx


class UpstashGameGroupCache:
    """Keep expensive RAWG discovery out of the request path between deploys."""

    _KEY_PREFIX = "gamingclock:game-groups:v2:"

    def __init__(
        self,
        url: str,
        token: str,
        ttl_seconds: int = 60 * 60 * 24 * 30,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._url = url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._ttl_seconds = ttl_seconds
        self._http_client = http_client or httpx.AsyncClient(timeout=0.25)
        self._owns_http_client = http_client is None

    @classmethod
    def from_environment(cls) -> UpstashGameGroupCache | None:
        url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
        return cls(url, token) if url and token else None

    async def get(self, key: str) -> Any | None:
        response = await self._http_client.get(
            f"{self._url}/get/{quote(self._key(key), safe='')}", headers=self._headers
        )
        response.raise_for_status()
        value = response.json().get("result")
        return json.loads(value) if value is not None else None

    async def set(self, key: str, value: Any) -> None:
        response = await self._http_client.post(
            self._url,
            headers=self._headers,
            json=["SET", self._key(key), json.dumps(value), "EX", self._ttl_seconds],
        )
        response.raise_for_status()

    async def aclose(self) -> None:
        if self._owns_http_client:
            await self._http_client.aclose()

    def _key(self, key: str) -> str:
        return f"{self._KEY_PREFIX}{key}"
