from tests.factories import GameFactory, GameListFactory, PlaySessionFactory


def test_game_factory():
    game = GameFactory.build()
    assert game.name
    assert game.main_story_hours > 0


def test_game_list_factory():
    game_list = GameListFactory.build()
    assert game_list.name
    assert isinstance(game_list.games, list)


def test_play_session_factory():
    session = PlaySessionFactory.build()
    assert session.game_name
    assert session.duration_hours > 0
