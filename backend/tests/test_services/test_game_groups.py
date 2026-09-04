import asyncio

import pytest

from gamingclock.models.catalog import CatalogGame
from gamingclock.models.game_groups import (
    GameGroupKind,
    GameGroupSource,
    ResolveGameGroupSelectionRequest,
)
from gamingclock.services.game_groups import (
    GameGroupExplorer,
    _Candidate,
    _canonical_games,
    _ExternalGame,
    _merge_candidates,
)


def _candidate(
    key: str,
    title: str,
    kind: GameGroupKind,
    source: GameGroupSource,
    members: set[int],
) -> _Candidate:
    return _Candidate(
        group_key=key,
        title=title,
        kind=kind,
        source_keys={source: key},
        member_ids=members,
    )


def test_keeps_source_native_groups_separate_during_discovery():
    merged = _merge_candidates(
        [
            _candidate("rawg:related:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.RAWG, {1, 2, 3}),
            _candidate("igdb:collection:39", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.IGDB, {1, 2}),
        ]
    )

    assert [candidate.group_key for candidate in merged] == [
        "rawg:related:1",
        "igdb:collection:39",
    ]


def test_never_merges_a_series_with_a_franchise_or_one_shared_member():
    merged = _merge_candidates(
        [
            _candidate("igdb:collection:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.IGDB, {1, 2}),
            _candidate("igdb:franchise:1", "Final Fantasy", GameGroupKind.FRANCHISE, GameGroupSource.IGDB, {1, 2}),
            _candidate("rawg:related:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.RAWG, {1, 3}),
        ]
    )

    assert len(merged) == 3


def test_preview_collapses_connected_port_and_remaster_variants():
    games, excluded = _canonical_games(
        [
            {
                "id": 1,
                "name": "Game",
                "game_type": 0,
                "version_parent": None,
                "first_release_date": 1,
                "ports": [2],
                "remasters": [],
                "expanded_games": [],
            },
            {
                "id": 2,
                "name": "Game Remaster",
                "game_type": 0,
                "version_parent": None,
                "first_release_date": 2,
                "ports": [],
                "remasters": [1],
                "expanded_games": [],
            },
            {
                "id": 3,
                "name": "Game DLC",
                "game_type": 1,
                "version_parent": None,
                "first_release_date": 3,
                "ports": [],
                "remasters": [],
                "expanded_games": [],
            },
        ]
    )

    assert [game.igdb_id for game in games] == [1]
    assert [item.label for item in excluded] == ["Game Remaster"]


@pytest.mark.asyncio
async def test_discovery_returns_a_source_native_card_without_reconciliation():
    explorer = GameGroupExplorer()
    candidate = explorer._external_candidate(
        "rawg:related:1",
        "Final Fantasy",
        [_ExternalGame("1", "Final Fantasy", 1987), _ExternalGame("2", "Final Fantasy II", 1988)],
        GameGroupSource.RAWG,
    )

    assert candidate.member_ids == set()
    assert [member.name for member in candidate.members] == ["Final Fantasy", "Final Fantasy II"]
    await explorer.aclose()


@pytest.mark.asyncio
async def test_selection_reconciles_only_checked_source_members(monkeypatch):
    explorer = GameGroupExplorer()
    candidate = _Candidate(
        group_key="rawg:related:1",
        title="Final Fantasy",
        kind=GameGroupKind.SERIES,
        source_keys={GameGroupSource.RAWG: "rawg:related:1"},
        members=[_ExternalGame("1", "One"), _ExternalGame("2", "Two")],
    )
    monkeypatch.setattr(explorer, "_candidate_for_key", lambda _: asyncio.sleep(0, result=candidate))
    calls: list[str] = []

    async def reconcile(member: _ExternalGame) -> CatalogGame | None:
        calls.append(member.source_id)
        return None

    monkeypatch.setattr(explorer, "_reconcile", reconcile)
    response = await explorer.resolve_selection(
        ResolveGameGroupSelectionRequest(group_key=candidate.group_key, source_member_ids=["2"])
    )

    assert calls == ["2"]
    assert response.resolutions[0].name == "Two"
    assert response.resolutions[0].game is None
    await explorer.aclose()
