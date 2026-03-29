from pydantic import BaseModel


class Game(BaseModel):
    name: str
    image_url: str
    main_story_hours: float
    main_extra_hours: float | None = None
    completionist_hours: float | None = None
