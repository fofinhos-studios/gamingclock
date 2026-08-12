"""Opt-in live checks for IGDB series and franchise membership data.

Run with ``RUN_LIVE_IGDB_TESTS=1 uv run pytest tests/test_live_igdb_series.py``.
The test uses the ignored root ``.env`` file when present and never prints credentials.
"""

import os
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

pytestmark = pytest.mark.live_igdb


@pytest.fixture(scope="module", autouse=True)
def require_live_igdb_credentials() -> None:
    if os.getenv("RUN_LIVE_IGDB_TESTS") != "1":
        pytest.skip("Set RUN_LIVE_IGDB_TESTS=1 to run authenticated live IGDB checks")

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    if not os.getenv("IGDB_CLIENT_ID") or not os.getenv("IGDB_CLIENT_SECRET"):
        pytest.skip("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are required for live checks")


async def _headers() -> dict[str, str]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": os.environ["IGDB_CLIENT_ID"],
                "client_secret": os.environ["IGDB_CLIENT_SECRET"],
                "grant_type": "client_credentials",
            },
        )
    response.raise_for_status()
    return {
        "Client-ID": os.environ["IGDB_CLIENT_ID"],
        "Authorization": f"Bearer {response.json()['access_token']}",
    }


async def _query(headers: dict[str, str], endpoint: str, body: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"https://api.igdb.com/v4/{endpoint}", headers=headers, content=body)
    response.raise_for_status()
    return response.json()


async def test_final_fantasy_franchise_members_can_all_be_hydrated() -> None:
    """A real franchise response can be expanded to a complete game preview."""
    headers = await _headers()

    collections = await _query(
        headers,
        "collections",
        'search "Final Fantasy"; fields id,name,games; limit 50;',
    )
    assert any(collection["name"] == "Final Fantasy" for collection in collections)

    franchises = await _query(
        headers,
        "franchises",
        'fields id,name,games; where name ~ "Final Fantasy"*; limit 50;',
    )
    final_fantasy = next(franchise for franchise in franchises if franchise["name"] == "Final Fantasy")
    member_ids = final_fantasy["games"]
    assert member_ids

    games = await _query(
        headers,
        "games",
        "fields id,name,first_release_date,game_type,version_parent; "
        f"where id = ({','.join(str(game_id) for game_id in member_ids)}); limit 500;",
    )

    assert {game["id"] for game in games} == set(member_ids)
    assert all(game["name"] for game in games)
