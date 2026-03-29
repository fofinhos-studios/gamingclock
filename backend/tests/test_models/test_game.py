from gamingclock.models.game import Game


def test_game_model():
    game = Game(
        name="Final Fantasy VII",
        image_url="https://howlongtobeat.com/games/ff7.png",
        main_story_hours=36.5,
        main_extra_hours=52.0,
        completionist_hours=82.0,
    )
    assert game.name == "Final Fantasy VII"
    assert game.main_story_hours == 36.5


def test_game_total_defaults_to_main_story():
    game = Game(
        name="Test",
        image_url="https://example.com/img.png",
        main_story_hours=10.0,
    )
    assert game.main_extra_hours is None
    assert game.completionist_hours is None
