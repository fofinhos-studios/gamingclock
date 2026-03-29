import datetime
from collections.abc import Iterator

from gamingclock.models.game import Game
from gamingclock.models.schedule import PlaySession, ScheduleAlgorithm, WeeklyAvailability


class SchedulerService:
    def generate(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        algorithm: ScheduleAlgorithm,
        start_date: datetime.date,
        default_start_time: datetime.time = datetime.time(20, 0),
    ) -> list[PlaySession]:
        if not games:
            return []

        if algorithm == ScheduleAlgorithm.SEQUENTIAL:
            return self._sequential(games, availability, start_date, default_start_time)
        if algorithm == ScheduleAlgorithm.ALTERNATING:
            return self._alternating(games, availability, start_date, default_start_time)
        raise ValueError(f"Unknown algorithm: {algorithm}")

    @staticmethod
    def _get_available_days_map(availability: WeeklyAvailability) -> dict[int, float]:
        return {day.day_of_week: day.hours for day in availability.days}

    def _iter_play_dates(
        self,
        start_date: datetime.date,
        available_days: dict[int, float],
    ) -> Iterator[tuple[datetime.date, float]]:
        current = start_date
        while True:
            weekday = current.weekday()
            if weekday in available_days:
                yield current, available_days[weekday]
            current += datetime.timedelta(days=1)

    def _sequential(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        start_date: datetime.date,
        default_start_time: datetime.time,
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        available_days = self._get_available_days_map(availability)
        date_iter = self._iter_play_dates(start_date, available_days)

        for game in games:
            remaining = game.main_story_hours
            while remaining > 0:
                date, hours = next(date_iter)
                session_hours = min(hours, remaining)
                sessions.append(
                    PlaySession(
                        game_name=game.name,
                        date=date,
                        start_time=default_start_time,
                        duration_hours=session_hours,
                    )
                )
                remaining -= session_hours

        return sessions

    def _alternating(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        start_date: datetime.date,
        default_start_time: datetime.time,
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        available_days = self._get_available_days_map(availability)
        date_iter = self._iter_play_dates(start_date, available_days)
        remaining = {game.name: game.main_story_hours for game in games}
        game_order = [game.name for game in games]
        game_idx = 0

        while any(hours > 0 for hours in remaining.values()):
            attempts = 0
            while remaining[game_order[game_idx]] <= 0:
                game_idx = (game_idx + 1) % len(game_order)
                attempts += 1
                if attempts > len(game_order):
                    break

            if attempts > len(game_order):
                break

            current_game = game_order[game_idx]
            date, hours = next(date_iter)
            session_hours = min(hours, remaining[current_game])
            sessions.append(
                PlaySession(
                    game_name=current_game,
                    date=date,
                    start_time=default_start_time,
                    duration_hours=session_hours,
                )
            )
            remaining[current_game] -= session_hours
            game_idx = (game_idx + 1) % len(game_order)

        return sessions
