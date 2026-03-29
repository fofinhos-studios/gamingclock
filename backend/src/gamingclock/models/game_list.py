from pydantic import BaseModel, Field, computed_field

from gamingclock.models.game import Game


class GameList(BaseModel):
    name: str
    games: list[Game] = Field(default_factory=list)

    @computed_field
    @property
    def total_main_story_hours(self) -> float:
        return sum(game.main_story_hours for game in self.games)
