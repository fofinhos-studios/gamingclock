import { CalendarDays } from "lucide-preact";
import { useLanguage } from "../i18n/i18n";
import type { WeeklyAvailability } from "../types";
import { AvailabilityForm } from "./availability-form";

interface Props {
  availability: WeeklyAvailability | null;
  gameCount: number;
  hasSchedule: boolean;
  onSubmit: (availability: WeeklyAvailability) => void;
}

export function PlannerAvailabilityStep({
  availability,
  gameCount,
  hasSchedule,
  onSubmit,
}: Props) {
  const { t } = useLanguage();
  const configuredDays = availability?.days.length ?? 0;

  return (
    <div class="planner-step-stack">
      <div class="planner-pane">
        <div class="planner-pane__header">
          <div class="space-y-1">
            <p class="section-eyebrow">{t.availability.title}</p>
            <h2 class="planner-panel__title planner-heading">
              <CalendarDays
                class="planner-icon planner-heading__icon"
                aria-hidden="true"
              />
              <span>{t.availability.heading}</span>
            </h2>
          </div>
          <p class="planner-panel__copy">{t.availability.copy}</p>
        </div>

        <AvailabilityForm availability={availability} onSubmit={onSubmit} />
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
