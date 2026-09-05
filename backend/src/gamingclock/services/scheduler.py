import datetime
from collections.abc import Iterator

from gamingclock.models.game import Game
from gamingclock.models.schedule import (
    DayAvailability,
    PlanningMode,
    PlaySession,
    ScheduleAlgorithm,
    WeeklyAvailability,
)


class DeadlineCapacityError(ValueError):
    """Raised when the requested deadline cannot fit within selected sessions."""


class SchedulerService:
    def generate(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        algorithm: ScheduleAlgorithm,
        start_date: datetime.date,
        planning_mode: PlanningMode = PlanningMode.WEEKLY,
        finish_by_date: datetime.date | None = None,
        max_session_hours: float = 4.0,
    ) -> list[PlaySession]:
        if not games:
            return []

        if planning_mode == PlanningMode.FINISH_BY:
            if finish_by_date is None:
                raise ValueError("finish_by_date is required for finish_by schedules")
            return self._finish_by(
                games,
                availability,
                algorithm,
                start_date,
                finish_by_date,
                max_session_hours,
            )

        if algorithm == ScheduleAlgorithm.SEQUENTIAL:
            return self._sequential(games, availability, start_date)
        if algorithm == ScheduleAlgorithm.ALTERNATING:
            return self._alternating(games, availability, start_date)
        raise ValueError(f"Unknown algorithm: {algorithm}")

    @staticmethod
    def _session_start(
        date: datetime.date,
        availability: DayAvailability,
        elapsed_hours: float,
    ) -> datetime.time:
        start = datetime.datetime.combine(
            date,
            datetime.time(availability.start_hour, availability.start_minute),
        )
        return (start + datetime.timedelta(hours=elapsed_hours)).time()

    def _finish_by(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        algorithm: ScheduleAlgorithm,
        start_date: datetime.date,
        finish_by_date: datetime.date,
        max_session_hours: float,
    ) -> list[PlaySession]:
        available_days = self._get_available_days_map(availability)
        slots: list[tuple[datetime.date, DayAvailability]] = []
        current = start_date
        while current <= finish_by_date:
            slots.extend((current, window) for window in available_days.get(current.weekday(), []))
            current += datetime.timedelta(days=1)

        if not slots:
            raise DeadlineCapacityError("No selected play times fall between the start date and Finish by date.")

        total_hours = sum(game.main_story_hours for game in games)
        slot_capacities = [min(window.hours, max_session_hours) for _, window in slots]
        total_capacity = sum(slot_capacities)
        if total_hours > total_capacity + 1e-9:
            raise DeadlineCapacityError(
                f"This deadline has only {total_capacity:.1f} hours of session capacity. "
                "Choose a later date, more play days, or a longer session limit."
            )

        budgets = self._allocate_finish_by_budgets(slot_capacities, total_hours)
        if algorithm == ScheduleAlgorithm.SEQUENTIAL:
            return self._finish_by_sequential(games, slots, budgets)
        if algorithm == ScheduleAlgorithm.ALTERNATING:
            return self._finish_by_alternating(games, slots, budgets)
        raise ValueError(f"Unknown algorithm: {algorithm}")

    @staticmethod
    def _allocate_finish_by_budgets(slot_capacities: list[float], total_hours: float) -> list[float]:
        """Spread time evenly without allocating more than any window can hold."""
        budgets = [0.0] * len(slot_capacities)
        remaining_slots = set(range(len(slot_capacities)))
        remaining_hours = total_hours

        while remaining_slots:
            equal_share = remaining_hours / len(remaining_slots)
            constrained_slots = [index for index in remaining_slots if slot_capacities[index] < equal_share - 1e-9]
            if not constrained_slots:
                for index in remaining_slots:
                    budgets[index] = equal_share
                return budgets

            for index in constrained_slots:
                budgets[index] = slot_capacities[index]
                remaining_hours -= slot_capacities[index]
                remaining_slots.remove(index)

        return budgets

    def _finish_by_sequential(
        self,
        games: list[Game],
        slots: list[tuple[datetime.date, DayAvailability]],
        budgets: list[float],
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        game_index = 0
        remaining_game = games[0].main_story_hours

        for (date, window), budget in zip(slots, budgets, strict=True):
            remaining_slot = budget
            elapsed_hours = 0.0
            while remaining_slot > 1e-9 and game_index < len(games):
                session_hours = min(remaining_slot, remaining_game)
                sessions.append(
                    PlaySession(
                        game_name=games[game_index].name,
                        date=date,
                        start_time=self._session_start(date, window, elapsed_hours),
                        duration_hours=session_hours,
                    )
                )
                remaining_slot -= session_hours
                elapsed_hours += session_hours
                remaining_game -= session_hours
                if remaining_game <= 1e-9:
                    game_index += 1
                    if game_index < len(games):
                        remaining_game = games[game_index].main_story_hours
        return sessions

    def _finish_by_alternating(
        self,
        games: list[Game],
        slots: list[tuple[datetime.date, DayAvailability]],
        budgets: list[float],
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        remaining = [game.main_story_hours for game in games]
        game_index = 0

        for (date, window), budget in zip(slots, budgets, strict=True):
            remaining_slot = budget
            elapsed_hours = 0.0
            while remaining_slot > 1e-9:
                attempts = 0
                while remaining[game_index] <= 1e-9:
                    game_index = (game_index + 1) % len(games)
                    attempts += 1
                    if attempts >= len(games):
                        return sessions
                session_hours = min(remaining_slot, remaining[game_index])
                sessions.append(
                    PlaySession(
                        game_name=games[game_index].name,
                        date=date,
                        start_time=self._session_start(date, window, elapsed_hours),
                        duration_hours=session_hours,
                    )
                )
                remaining[game_index] -= session_hours
                remaining_slot -= session_hours
                elapsed_hours += session_hours
                game_index = (game_index + 1) % len(games)
        return sessions

    @staticmethod
    def _get_available_days_map(
        availability: WeeklyAvailability,
    ) -> dict[int, list[DayAvailability]]:
        windows_by_day: dict[int, list[DayAvailability]] = {}
        for window in availability.days:
            windows_by_day.setdefault(window.day_of_week, []).append(window)

        for windows in windows_by_day.values():
            windows.sort(key=lambda window: (window.start_hour, window.start_minute))

        return windows_by_day

    def _iter_play_dates(
        self,
        start_date: datetime.date,
        available_days: dict[int, list[DayAvailability]],
    ) -> Iterator[tuple[datetime.date, DayAvailability]]:
        current = start_date
        while True:
            weekday = current.weekday()
            if weekday in available_days:
                for window in available_days[weekday]:
                    yield current, window
            current += datetime.timedelta(days=1)

    def _sequential(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        start_date: datetime.date,
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        available_days = self._get_available_days_map(availability)
        date_iter = self._iter_play_dates(start_date, available_days)

        for game in games:
            remaining = game.main_story_hours
            while remaining > 0:
                date, day_availability = next(date_iter)
                session_hours = min(day_availability.hours, remaining)
                sessions.append(
                    PlaySession(
                        game_name=game.name,
                        date=date,
                        start_time=datetime.time(
                            day_availability.start_hour,
                            day_availability.start_minute,
                        ),
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
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        available_days = self._get_available_days_map(availability)
        date_iter = self._iter_play_dates(start_date, available_days)
        remaining = [game.main_story_hours for game in games]
        game_idx = 0

        while any(hours > 0 for hours in remaining):
            attempts = 0
            while remaining[game_idx] <= 0:
                game_idx = (game_idx + 1) % len(games)
                attempts += 1
                if attempts > len(games):
                    break

            if attempts > len(games):
                break

            current_game = games[game_idx]
            date, day_availability = next(date_iter)
            session_hours = min(day_availability.hours, remaining[game_idx])
            sessions.append(
                PlaySession(
                    game_name=current_game.name,
                    date=date,
                    start_time=datetime.time(
                        day_availability.start_hour,
                        day_availability.start_minute,
                    ),
                    duration_hours=session_hours,
                )
            )
            remaining[game_idx] -= session_hours
            game_idx = (game_idx + 1) % len(games)

        return sessions
