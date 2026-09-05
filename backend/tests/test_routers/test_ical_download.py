import base64
import json
import zlib

from gamingclock.routers.schedule import MAX_CALENDAR_URL_DECOMPRESSED_BYTES


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


def test_download_ical_uses_edited_sessions_when_provided(client):
    response = client.post(
        "/schedule/ical",
        json={
            "game_list_name": "Edited",
            "games": [],
            "availability": {"days": [{"day_of_week": 0, "hours": 1}]},
            "sessions": [
                {
                    "game_name": "Moved game",
                    "date": "2026-04-03",
                    "start_time": "17:30:00",
                    "duration_hours": 4,
                }
            ],
        },
    )

    assert response.status_code == 200
    assert "Moved game" in response.text
    assert "20260403T173000" in response.text


def test_calendar_url_serves_a_portable_ical_export(client):
    calendar_payload = {
        "game_list_name": "Edited schedule",
        "sessions": [
            {
                "game_name": "Moved game",
                "date": "2026-04-03",
                "start_time": "17:30:00",
                "duration_hours": 4,
            }
        ],
    }
    compressor = zlib.compressobj(wbits=-zlib.MAX_WBITS)
    compressed = compressor.compress(json.dumps(calendar_payload).encode()) + compressor.flush()
    payload = base64.urlsafe_b64encode(compressed).decode().rstrip("=")

    response = client.get("/schedule/ical-url", params={"payload": payload})

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/calendar; charset=utf-8"
    assert response.headers["content-disposition"] == "inline; filename=gaming-clock.ics"
    assert "Moved game" in response.text
    assert "20260403T173000" in response.text


def test_calendar_url_rejects_invalid_payloads(client):
    response = client.get("/schedule/ical-url", params={"payload": "not-calendar-data"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid calendar URL"


def test_calendar_url_rejects_decompression_bombs_before_json_parsing(client):
    compressor = zlib.compressobj(wbits=-zlib.MAX_WBITS)
    compressed = compressor.compress(b"x" * (MAX_CALENDAR_URL_DECOMPRESSED_BYTES + 1)) + compressor.flush()
    payload = base64.urlsafe_b64encode(compressed).decode().rstrip("=")

    response = client.get("/schedule/ical-url", params={"payload": payload})

    assert response.status_code == 413
    assert response.json()["detail"] == "Calendar URL payload is too large"


def test_calendar_url_rejects_more_sessions_than_the_public_limit(client):
    calendar_payload = {
        "game_list_name": "Edited schedule",
        "sessions": [
            {
                "game_name": "Game",
                "date": "2026-04-03",
                "start_time": "17:30:00",
                "duration_hours": 1,
            }
            for _ in range(501)
        ],
    }
    payload = base64.urlsafe_b64encode(json.dumps(calendar_payload).encode()).decode().rstrip("=")

    response = client.get("/schedule/ical-url", params={"payload": payload, "encoding": "plain"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid calendar URL"
