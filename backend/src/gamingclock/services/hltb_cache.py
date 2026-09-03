"""Shared cache for HLTB matches in serverless deployments."""

import json
import os
from typing import Any
from urllib.parse import quote

import httpx

from gamingclock.models.game import Game


class UpstashHLTBCache:
    """Store serialised HLTB matches in an Upstash Redis REST database."""

    _KEY_PREFIX = "gamingclock:hltb:"
    _DEFAULT_CACHE_VERSION = "v2"

    def __init__(
        self,
        url: str,
        token: str,
        ttl_seconds: int = 604800,
        cache_version: str = _DEFAULT_CACHE_VERSION,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._url = url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._ttl_seconds = ttl_seconds
        self._cache_version = cache_version
        self._http_client = http_client or httpx.AsyncClient(timeout=0.5)
        self._owns_http_client = http_client is None

    @classmethod
    def from_environment(cls) -> UpstashHLTBCache | None:
        url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
        if not url or not token:
            return None
        cache_version = os.getenv("HLTB_CACHE_VERSION", cls._DEFAULT_CACHE_VERSION).strip()
        return cls(url=url, token=token, cache_version=cache_version or cls._DEFAULT_CACHE_VERSION)

    async def get(self, normalized_query: str) -> list[Game] | None:
        key = self._key(normalized_query)
        response = await self._http_client.get(f"{self._url}/get/{quote(key, safe='')}", headers=self._headers)
        response.raise_for_status()
        value = response.json().get("result")
        if value is None:
            return None
        return [Game.model_validate(item) for item in json.loads(value)]

    async def set(self, normalized_query: str, results: list[Game]) -> None:
        value = json.dumps([result.model_dump(mode="json") for result in results])
        command: list[Any] = ["SET", self._key(normalized_query), value, "EX", self._ttl_seconds]
        response = await self._http_client.post(self._url, headers=self._headers, json=command)
        response.raise_for_status()

    async def aclose(self) -> None:
        if self._owns_http_client:
            await self._http_client.aclose()

    def _key(self, normalized_query: str) -> str:
        return f"{self._KEY_PREFIX}{self._cache_version}:{normalized_query}"
