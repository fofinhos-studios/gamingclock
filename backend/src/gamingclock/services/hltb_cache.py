"""Shared cache for HLTB matches in serverless deployments."""

import json
import os
from typing import Any
from urllib.parse import quote

import httpx

from gamingclock.models.game import Game


class UpstashHLTBCache:
    """Store serialised HLTB matches in an Upstash Redis REST database."""

    _KEY_PREFIX = "gamingclock:hltb:v1:"

    def __init__(self, url: str, token: str, ttl_seconds: int = 604800) -> None:
        self._url = url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._ttl_seconds = ttl_seconds

    @classmethod
    def from_environment(cls) -> UpstashHLTBCache | None:
        url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
        if not url or not token:
            return None
        return cls(url=url, token=token)

    async def get(self, normalized_query: str) -> list[Game] | None:
        key = self._key(normalized_query)
        async with httpx.AsyncClient(timeout=1.0) as client:
            response = await client.get(f"{self._url}/get/{quote(key, safe='')}", headers=self._headers)
            response.raise_for_status()
        value = response.json().get("result")
        if value is None:
            return None
        return [Game.model_validate(item) for item in json.loads(value)]

    async def set(self, normalized_query: str, results: list[Game]) -> None:
        value = json.dumps([result.model_dump(mode="json") for result in results])
        command: list[Any] = ["SET", self._key(normalized_query), value, "EX", self._ttl_seconds]
        async with httpx.AsyncClient(timeout=1.0) as client:
            response = await client.post(self._url, headers=self._headers, json=command)
            response.raise_for_status()

    def _key(self, normalized_query: str) -> str:
        return f"{self._KEY_PREFIX}{normalized_query}"
