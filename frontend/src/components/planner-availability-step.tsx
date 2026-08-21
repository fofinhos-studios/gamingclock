import { CalendarDotsIcon } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import type { WeeklyAvailability } from "../types";
import { AvailabilityForm } from "./availability-form";

interface Props {
  availability: WeeklyAvailability | null;
  gameCount: number;
  hasSchedule: boolean;
  onChange: (availability: WeeklyAvailability | null) => void;
}

export function PlannerAvailabilityStep({
  availability,
  gameCount,
  hasSchedule,
  onChange,
}: Props) {
  const { t } = useLanguage();
  const configuredDays = availability?.days.length ?? 0;

  return (
    <div class="planner-step-stack">
      <div class="planner-pane">
        <div class="planner-pane__header">
          <div class="space-y-1">
            <h2 class="planner-panel__title planner-heading">
              <CalendarDotsIcon
                class="planner-icon planner-heading__icon"
                aria-hidden="true"
              />
              <span>{t.availability.heading}</span>
            </h2>
          </div>
        </div>

        <AvailabilityForm availability={availability} onChange={onChange} />
      </div>

      <div class="planner-note-grid">
        <section class="planner-note">
          <p class="planner-note__label">{t.availability.status}</p>
          <p class="planner-note__value">
            {availability ? t.availability.saved : t.availability.notSet}
          </p>
          <p class="planner-note__text">
            {hasSchedule
              ? t.availability.scheduleWarning
              : availability
                ? t.availability.configured(configuredDays)
                : t.availability.prompt}
          </p>
        </section>

        <section class="planner-note">
          <p class="planner-note__label">{t.availability.currentBacklog}</p>
          <p class="planner-note__value">{t.availability.games(gameCount)}</p>
          <p class="planner-note__text">
            {gameCount === 0
              ? t.availability.addGame
              : t.availability.changeTime}
          </p>
        </section>
      </div>
    </div>
  );
}
