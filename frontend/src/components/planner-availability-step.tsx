import { CalendarDotsIcon } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import type { PlanningMode, WeeklyAvailability } from "../types";
import { AvailabilityForm } from "./availability-form";

interface Props {
  availability: WeeklyAvailability | null;
  planningMode: PlanningMode;
  onChange: (availability: WeeklyAvailability | null) => void;
}

export function PlannerAvailabilityStep({
  availability,
  planningMode,
  onChange,
}: Props) {
  const { t } = useLanguage();

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

        <AvailabilityForm
          availability={availability}
          planningMode={planningMode}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
