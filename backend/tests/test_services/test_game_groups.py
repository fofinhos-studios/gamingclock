from gamingclock.models.game_groups import GameGroupKind, GameGroupSource
from gamingclock.services.game_groups import _Candidate, _canonical_games, _merge_candidates


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


def test_merges_matching_source_groups_when_overlap_meets_threshold():
    merged = _merge_candidates(
        [
            _candidate("rawg:related:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.RAWG, {1, 2, 3}),
            _candidate("igdb:collection:39", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.IGDB, {1, 2}),
        ]
    )

    assert len(merged) == 1
    assert merged[0].group_key == "igdb:collection:39"
    assert merged[0].member_ids == {1, 2, 3}
    assert set(merged[0].source_keys) == {GameGroupSource.IGDB, GameGroupSource.RAWG}


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
