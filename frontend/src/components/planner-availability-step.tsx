import { CalendarDotsIcon } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import type { WeeklyAvailability } from "../types";
import { AvailabilityForm } from "./availability-form";

interface Props {
  availability: WeeklyAvailability | null;
  onSubmit: (availability: WeeklyAvailability) => void;
}

export function PlannerAvailabilityStep({ availability, onSubmit }: Props) {
  const { t } = useLanguage();

  return (
    <div class="planner-pane planner-pane--availability">
      <h2 class="planner-panel__title planner-heading">
        <CalendarDotsIcon
          class="planner-icon planner-heading__icon"
          aria-hidden="true"
        />
        <span>{t.availability.heading}</span>
      </h2>
      <AvailabilityForm availability={availability} onSubmit={onSubmit} />
    </div>
  );
}
