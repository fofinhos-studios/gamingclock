import {
  CalendarIcon,
  CheckIcon,
  CircleNotchIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useState } from "preact/hooks";
import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
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
  onGenerateSchedule: () => Promise<boolean>;
  onDownloadIcal: () => Promise<boolean>;
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
  const { t } = useLanguage();
  const prerequisitesDescriptionId = "schedule-prerequisites";
  const [isGenerating, setIsGenerating] = useState(false);
  const feedback = useTransientFeedback<"success">();

  const handleGenerateClick = async () => {
    setIsGenerating(true);
    const success = await onGenerateSchedule();
    setIsGenerating(false);
    if (success) {
      feedback.trigger("success", 1800);
    } else {
      feedback.clear();
    }
  };

  return (
    <section
      class="planner-step-stack"
      aria-labelledby="planner-schedule-heading"
    >
      <div class="planner-pane">
        <div class="planner-pane__header">
          <div class="space-y-1">
            <h2
              id="planner-schedule-heading"
              class="planner-panel__title planner-heading"
            >
              <CalendarIcon
                class="planner-icon planner-heading__icon"
                aria-hidden="true"
              />
              <span>{t.schedule.heading}</span>
            </h2>
          </div>
        </div>

        <div class="planner-controls">
          <Field label={t.schedule.startDate} controlId="schedule-start-date">
            <Input
              id="schedule-start-date"
              type="date"
              value={startDate}
              title={t.schedule.changeHint}
              aria-description={t.schedule.changeHint}
              onInput={(event) =>
                onStartDateChange((event.target as HTMLInputElement).value)
              }
            />
          </Field>

          <Field label={t.schedule.algorithm} controlId="schedule-algorithm">
            <Select
              id="schedule-algorithm"
              value={algorithm}
              title={t.schedule.changeHint}
              aria-description={t.schedule.changeHint}
              onChange={(event) =>
                onAlgorithmChange(
                  (event.target as HTMLSelectElement)
                    .value as ScheduleAlgorithm,
                )
              }
            >
              <option value="sequential">{t.schedule.sequential}</option>
              <option value="alternating">{t.schedule.alternating}</option>
            </Select>
          </Field>

          <div class="planner-controls__actions">
            <Button
              type="button"
              onClick={() => void handleGenerateClick()}
              disabled={!canGenerateSchedule || isGenerating}
              aria-describedby={
                prerequisiteMessages.length > 0
                  ? prerequisitesDescriptionId
                  : undefined
              }
              aria-description={
                prerequisiteMessages.length > 0
                  ? prerequisiteMessages.map(({ message }) => message).join(" ")
                  : undefined
              }
              variant="primary"
              size="sm"
              feedbackState={
                isGenerating
                  ? "loading"
                  : feedback.active === "success"
                    ? "success"
                    : "idle"
              }
            >
              {isGenerating ? (
                <CircleNotchIcon
                  class="planner-icon planner-icon--spin"
                  aria-hidden="true"
                />
              ) : feedback.active === "success" ? (
                <CheckIcon class="planner-icon" aria-hidden="true" />
              ) : (
                <SparkleIcon class="planner-icon" aria-hidden="true" />
              )}
              {isGenerating
                ? t.schedule.generating
                : feedback.active === "success"
                  ? t.schedule.generated
                  : t.schedule.generate}
            </Button>
          </div>
        </div>

        {prerequisiteMessages.length > 0 && (
          <output id={prerequisitesDescriptionId} class="planner-inline-notice">
            <ul class="planner-inline-notice__list">
              {prerequisiteMessages.map((prerequisite) => (
                <li key={prerequisite.id}>{prerequisite.message}</li>
              ))}
            </ul>
          </output>
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
