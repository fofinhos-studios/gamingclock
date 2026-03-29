from gamingclock.models.game import Game
from gamingclock.models.game_list import GameList


def _make_game(name: str, hours: float) -> Game:
    return Game(name=name, image_url="https://example.com/img.png", main_story_hours=hours)


def test_game_list_total_hours():
    gl = GameList(
        name="Final Fantasy Series",
        games=[_make_game("FF7", 36.5), _make_game("FF8", 40.0)],
    )
    assert gl.total_main_story_hours == 76.5


def test_empty_game_list():
    gl = GameList(name="Empty", games=[])
    assert gl.total_main_story_hours == 0.0
