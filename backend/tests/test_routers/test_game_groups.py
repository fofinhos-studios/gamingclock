from unittest.mock import AsyncMock, patch

from gamingclock.models.game_groups import (
    GameGroupEvidence,
    GameGroupKind,
    GameGroupSearchResult,
    GameGroupSource,
)


def _group() -> GameGroupSearchResult:
    return GameGroupSearchResult(
        group_key="igdb:collection:39",
        display_name="Final Fantasy — series",
        scope_name="series",
        card_kind=GameGroupKind.SERIES,
        candidate_count=16,
        sources=[GameGroupEvidence(source=GameGroupSource.IGDB, label="IGDB")],
    )


def test_search_game_groups_returns_automatically_named_cards(client):
    with patch("gamingclock.routers.game_groups.game_group_explorer") as explorer:
        explorer.search = AsyncMock(return_value=[_group()])
        response = client.get("/game-groups/search", params={"query": "Final Fantasy"})

    assert response.status_code == 200
    assert response.json()[0]["display_name"] == "Final Fantasy — series"
    assert response.headers["cache-control"] == "public, s-maxage=300, stale-while-revalidate=86400"


def test_game_group_preview_rejects_an_unknown_group(client):
    with patch("gamingclock.routers.game_groups.game_group_explorer") as explorer:
        explorer.preview = AsyncMock(side_effect=LookupError("unknown"))
        response = client.post("/game-groups/preview", json={"group_key": "unknown"})

    assert response.status_code == 404


def test_game_group_preview_validates_its_input(client):
    response = client.post("/game-groups/preview", json={"group_key": ""})

    assert response.status_code == 422
