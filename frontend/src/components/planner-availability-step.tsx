import { CalendarDays } from "lucide-preact";
import type { WeeklyAvailability } from "../types";
import { AvailabilityForm } from "./availability-form";

interface Props {
  availability: WeeklyAvailability | null;
  gameCount: number;
  onSubmit: (availability: WeeklyAvailability) => void;
}

export function PlannerAvailabilityStep({
  availability,
  gameCount,
  onSubmit,
}: Props) {
  const configuredDays = availability?.days.length ?? 0;

  return (
    <div class="planner-step-stack">
      <div class="planner-pane">
        <div class="planner-pane__header">
          <div class="space-y-1">
            <p class="section-eyebrow">Availability</p>
            <h2 class="planner-panel__title planner-heading">
              <CalendarDays
                class="planner-icon planner-heading__icon"
                aria-hidden="true"
              />
              <span>Weekly play time</span>
            </h2>
          </div>
          <p class="planner-panel__copy">
            Set the days, session length, and start time that suit your week.
          </p>
        </div>

        <AvailabilityForm onSubmit={onSubmit} />
      </div>

      <div class="planner-note-grid">
        <section class="planner-note">
          <p class="planner-note__label">Status</p>
          <p class="planner-note__value">
            {availability ? "Availability saved" : "Availability not set"}
          </p>
          <p class="planner-note__text">
            {availability
              ? `${configuredDays} day${configuredDays === 1 ? "" : "s"} configured. Saving again will clear any generated schedule.`
              : "Set your weekly time and start hour now, or come back after adding games."}
          </p>
        </section>

        <section class="planner-note">
          <p class="planner-note__label">Current backlog</p>
          <p class="planner-note__value">
            {gameCount} game{gameCount === 1 ? "" : "s"} in this backlog
          </p>
          <p class="planner-note__text">
            {gameCount === 0
              ? "Add a game before you create a schedule."
              : "Change your play time before you create a new schedule."}
          </p>
        </section>
      </div>
    </div>
  );
}
