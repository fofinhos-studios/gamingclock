import asyncio
import os
from urllib.parse import quote

import httpx

from gamingclock.models.catalog import GameArtwork


class SteamGridDBService:
    """Retrieve game logos and hero banners from SteamGridDB when configured."""

    _base_url = "https://www.steamgriddb.com/api/v2"

    def __init__(self, http_client: httpx.AsyncClient | None = None):
        self._http_client = http_client or httpx.AsyncClient()

    async def get_artwork(self, game_name: str) -> GameArtwork:
        api_key = os.getenv("STEAMGRIDDB_API_KEY")
        normalized_name = game_name.strip()
        if not api_key or not normalized_name:
            return GameArtwork()

        headers = {"Authorization": f"Bearer {api_key}"}
        search_response = await self._http_client.get(
            f"{self._base_url}/search/autocomplete/{quote(normalized_name, safe='')}",
            headers=headers,
        )
        search_response.raise_for_status()
        game_id = self._select_game_id(search_response.json(), normalized_name)
        if game_id is None:
            return GameArtwork()

        logo_response, hero_response = await asyncio.gather(
            self._http_client.get(
                f"{self._base_url}/logos/game/{game_id}",
                headers=headers,
                params={"types": "static", "limit": 1},
            ),
            self._http_client.get(
                f"{self._base_url}/heroes/game/{game_id}",
                headers=headers,
                params={"types": "static", "limit": 1},
            ),
        )
        logo_response.raise_for_status()
        hero_response.raise_for_status()
        return GameArtwork(
            logo_url=self._first_image_url(logo_response.json()),
            hero_url=self._first_image_url(hero_response.json()),
        )

    @staticmethod
    def _select_game_id(payload: dict, game_name: str) -> int | None:
        games = payload.get("data") or []
        exact_match = next(
            (game for game in games if game.get("name", "").casefold() == game_name.casefold()),
            None,
        )
        selected_game = exact_match or (games[0] if games else None)
        game_id = selected_game.get("id") if selected_game else None
        return game_id if isinstance(game_id, int) else None

    @staticmethod
    def _first_image_url(payload: dict) -> str:
        images = payload.get("data") or []
        if not images:
            return ""
        url = images[0].get("url")
        return url if isinstance(url, str) else ""
