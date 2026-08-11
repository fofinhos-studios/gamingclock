from typing import ClassVar

from gamingclock.models.catalog import CatalogGame


class IGDBService:
    """Local catalog substitute for IGDB during the MVP."""

    _catalog: ClassVar[list[CatalogGame]] = [
        CatalogGame(
            igdb_id=7,
            name="Final Fantasy VII",
            cover_url="https://images.igdb.com/igdb/image/upload/t_thumb/cover.jpg",
            summary="A mercenary joins a group fighting to save the planet.",
            genres=["RPG"],
            platforms=["PlayStation"],
            release_year=1997,
            rating=91.2,
        ),
        CatalogGame(
            igdb_id=22,
            name="Chrono Trigger",
            cover_url="https://images.igdb.com/igdb/image/upload/t_thumb/chrono.jpg",
            summary="A time-travelling role-playing adventure.",
            genres=["RPG"],
            platforms=["Super Nintendo"],
            release_year=1995,
            rating=96.0,
        ),
    ]

    async def search(self, query: str, limit: int = 10) -> list[CatalogGame]:
        normalized_query = query.strip().casefold()
        if not normalized_query:
            return []
        return [game for game in self._catalog if normalized_query in game.name.casefold()][0:limit]

    async def get_by_id(self, igdb_id: int) -> CatalogGame:
        for game in self._catalog:
            if game.igdb_id == igdb_id:
                return game
        raise RuntimeError(f"IGDB game not found: {igdb_id}")
