import os
import time

import httpx

from gamingclock.models.catalog import CatalogGame, release_year_from_epoch


class IGDBService:
    def __init__(
        self,
        http_client: httpx.AsyncClient | None = None,
        token_client: httpx.AsyncClient | None = None,
    ):
        self._http_client = http_client or httpx.AsyncClient()
        self._token_client = token_client or httpx.AsyncClient()
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    async def search(self, query: str, limit: int = 10) -> list[CatalogGame]:
        client_id, token = await self._get_auth_headers()
        normalized = query.strip().lower()
        body = (
            "fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name;"
            f'where name ~ "{normalized}"*;'
            "sort rating desc;"
            f"limit {limit};"
        )
        response = await self._http_client.post(
            "https://api.igdb.com/v4/games",
            headers={
                "Client-ID": client_id,
                "Authorization": f"Bearer {token}",
            },
            content=body,
        )
        response.raise_for_status()
        return [self._to_catalog_game(item) for item in response.json()]

    async def get_by_id(self, igdb_id: int) -> CatalogGame:
        client_id, token = await self._get_auth_headers()
        body = (
            "fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name;"
            f"where id = {igdb_id};"
            "limit 1;"
        )
        response = await self._http_client.post(
            "https://api.igdb.com/v4/games",
            headers={
                "Client-ID": client_id,
                "Authorization": f"Bearer {token}",
            },
            content=body,
        )
        response.raise_for_status()
        results = response.json()
        if not results:
            raise RuntimeError(f"IGDB game not found: {igdb_id}")
        return self._to_catalog_game(results[0])

    async def _get_auth_headers(self) -> tuple[str, str]:
        client_id = os.getenv("IGDB_CLIENT_ID")
        client_secret = os.getenv("IGDB_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise RuntimeError("IGDB credentials are not configured")

        if self._access_token and time.time() < self._expires_at:
            return client_id, self._access_token

        response = await self._token_client.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
            },
        )
        response.raise_for_status()
        payload = response.json()
        self._access_token = payload["access_token"]
        self._expires_at = time.time() + max(payload.get("expires_in", 0) - 60, 0)
        return client_id, self._access_token

    @staticmethod
    def _to_catalog_game(item: dict) -> CatalogGame:
        cover_url = item.get("cover", {}).get("url") or ""
        if cover_url.startswith("//"):
            cover_url = f"https:{cover_url}"
        return CatalogGame(
            igdb_id=item["id"],
            name=item["name"],
            cover_url=cover_url,
            summary=item.get("summary") or "",
            genres=[genre["name"] for genre in item.get("genres") or []],
            platforms=[platform["name"] for platform in item.get("platforms") or []],
            release_year=release_year_from_epoch(item.get("first_release_date")),
            rating=item.get("rating"),
        )
