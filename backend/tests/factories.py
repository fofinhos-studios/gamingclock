from polyfactory.factories.pydantic_factory import ModelFactory

from gamingclock.models.game import Game
from gamingclock.models.game_list import GameList
from gamingclock.models.schedule import PlaySession


class GameFactory(ModelFactory[Game]):
    __model__ = Game

    main_story_hours = 10.0
    main_extra_hours = 15.0
    completionist_hours = 20.0


class GameListFactory(ModelFactory[GameList]):
    __model__ = GameList


class PlaySessionFactory(ModelFactory[PlaySession]):
    __model__ = PlaySession

    duration_hours = 2.0
