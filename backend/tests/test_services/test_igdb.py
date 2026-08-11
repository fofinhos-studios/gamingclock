import pytest

from gamingclock.services.igdb import IGDBService


@pytest.mark.asyncio
async def test_igdb_search_returns_mocked_metadata_without_credentials(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)

    results = await IGDBService().search("Final Fantasy")

    assert results[0].igdb_id == 7
    assert results[0].name == "Final Fantasy VII"
    assert results[0].summary


@pytest.mark.asyncio
async def test_igdb_get_by_id_returns_mocked_game():
    result = await IGDBService().get_by_id(22)

    assert result.igdb_id == 22
    assert result.name == "Chrono Trigger"
