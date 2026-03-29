import { AlertCircle, CalendarRange, Sparkles } from "lucide-preact";
import type {
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";
import { ScheduleView } from "./schedule-view";
import { Button, Field, Input, Select } from "./ui";

interface PrerequisiteMessage {
  id: string;
  message: string;
}

interface Props {
  availability: WeeklyAvailability | null;
  algorithm: ScheduleAlgorithm;
  startDate: string;
  schedule: ScheduleResponse | null;
  actionError: string;
  canGenerateSchedule: boolean;
  prerequisiteMessages: PrerequisiteMessage[];
  onAlgorithmChange: (algorithm: ScheduleAlgorithm) => void;
  onStartDateChange: (startDate: string) => void;
  onGenerateSchedule: () => void;
  onDownloadIcal: () => void;
}

export function PlannerScheduleStep({
  availability,
  algorithm,
  startDate,
  schedule,
  actionError,
  canGenerateSchedule,
  prerequisiteMessages,
  onAlgorithmChange,
  onStartDateChange,
  onGenerateSchedule,
  onDownloadIcal,
}: Props) {
  const prerequisitesDescriptionId = "schedule-prerequisites";

  return (
    <section
      class="planner-step-stack"
      aria-labelledby="planner-schedule-heading"
    >
      <div class="planner-pane">
        <div class="planner-pane__header">
          <div class="space-y-1">
            <p class="section-eyebrow">Schedule</p>
            <h2
              id="planner-schedule-heading"
              class="planner-panel__title planner-heading"
            >
              <CalendarRange
                class="planner-icon planner-heading__icon"
                aria-hidden="true"
              />
              <span>Generate schedule</span>
            </h2>
          </div>
          <p class="planner-panel__copy">
            Pick a start date and algorithm for the current backlog.
          </p>
        </div>

        <div class="planner-controls">
          <Field label="Start date" controlId="schedule-start-date">
            <Input
              id="schedule-start-date"
              type="date"
              value={startDate}
              onInput={(event) =>
                onStartDateChange((event.target as HTMLInputElement).value)
              }
            />
          </Field>

          <Field label="Algorithm" controlId="schedule-algorithm">
            <Select
              id="schedule-algorithm"
              value={algorithm}
              onChange={(event) =>
                onAlgorithmChange(
                  (event.target as HTMLSelectElement)
                    .value as ScheduleAlgorithm,
                )
              }
            >
              <option value="sequential">Sequential</option>
              <option value="alternating">Alternating</option>
            </Select>
          </Field>

          <div class="planner-controls__actions">
            <Button
              type="button"
              onClick={onGenerateSchedule}
              disabled={!canGenerateSchedule}
              aria-describedby={
                prerequisiteMessages.length > 0
                  ? prerequisitesDescriptionId
                  : undefined
              }
              variant="primary"
              size="sm"
            >
              <Sparkles class="planner-icon" aria-hidden="true" />
              Generate Schedule
            </Button>
            <p class="planner-controls__hint">
              {availability
                ? "Changing inputs clears the last generated plan."
                : "Set weekly availability before generating."}
            </p>
          </div>
        </div>

        {prerequisiteMessages.length > 0 && (
          <div id={prerequisitesDescriptionId} class="planner-inline-notice">
            <p class="planner-inline-notice__label">
              <AlertCircle
                class="planner-icon planner-inline-notice__icon"
                aria-hidden="true"
              />
              <span>Before you generate</span>
            </p>
            <ul class="planner-inline-notice__list">
              {prerequisiteMessages.map((prerequisite) => (
                <li key={prerequisite.id}>{prerequisite.message}</li>
              ))}
            </ul>
          </div>
        )}

        {actionError && (
          <p role="alert" class="planner-error">
            {actionError}
          </p>
        )}
      </div>

      {schedule && (
        <div class="planner-pane">
          <ScheduleView schedule={schedule} onDownloadIcal={onDownloadIcal} />
        </div>
      )}
    </section>
  );
}
