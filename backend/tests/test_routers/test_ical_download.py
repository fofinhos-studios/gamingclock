def test_download_ical(client):
    response = client.post(
        "/schedule/ical",
        json={
            "game_list_name": "Test",
            "games": [
                {
                    "igdb_id": 10,
                    "name": "FF7",
                    "cover_url": "https://example.com/ff7.png",
                    "summary": "Classic RPG",
                    "genres": ["RPG"],
                    "platforms": ["PlayStation"],
                    "release_year": 1997,
                    "rating": 95.0,
                    "hltb_status": "resolved",
                    "hltb_match_name": "Final Fantasy VII",
                    "main_story_hours": 2.0,
                    "main_extra_hours": 4.0,
                    "completionist_hours": 8.0,
                },
            ],
            "availability": {"days": [{"day_of_week": 0, "hours": 2.0, "start_hour": 18}]},
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/calendar; charset=utf-8"
    body = response.text
    assert "BEGIN:VCALENDAR" in body
    assert "FF7" in body
    assert "T180000" in body


def test_download_ical_skips_unresolved_games(client):
    response = client.post(
        "/schedule/ical",
        json={
            "game_list_name": "Blocked",
            "games": [
                {
                    "igdb_id": 10,
                    "name": "FF7",
                    "cover_url": "https://example.com/ff7.png",
                    "summary": "Classic RPG",
                    "genres": ["RPG"],
                    "platforms": ["PlayStation"],
                    "release_year": 1997,
                    "rating": 95.0,
                    "hltb_status": "resolved",
                    "hltb_match_name": "Final Fantasy VII",
                    "main_story_hours": 2.0,
                    "main_extra_hours": 4.0,
                    "completionist_hours": 8.0,
                },
                {
                    "igdb_id": 11,
                    "name": "Unknown Game",
                    "cover_url": "",
                    "summary": "",
                    "genres": [],
                    "platforms": [],
                    "release_year": None,
                    "rating": None,
                    "hltb_status": "unresolved",
                    "hltb_match_name": None,
                    "main_story_hours": None,
                    "main_extra_hours": None,
                    "completionist_hours": None,
                },
            ],
            "availability": {"days": [{"day_of_week": 0, "hours": 2.0}]},
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )

    assert response.status_code == 200
    assert "FF7" in response.text
    assert "Unknown Game" not in response.text
