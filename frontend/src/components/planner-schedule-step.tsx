import {
  AlertCircle,
  CalendarRange,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-preact";
import { useState } from "preact/hooks";
import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import type {
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";
import type { PlannerTab } from "./planner-tabs";
import { ScheduleView } from "./schedule-view";
import { Button, Field, Input, Select } from "./ui";

interface PrerequisiteMessage {
  id: string;
  message: string;
  target: Exclude<PlannerTab, "schedule">;
}

interface Props {
  availability: WeeklyAvailability | null;
  gameListName: string;
  gameCount: number;
  totalSelectedHours: number;
  weeklyHours: number;
  algorithm: ScheduleAlgorithm;
  startDate: string;
  schedule: ScheduleResponse | null;
  actionError: string;
  canGenerateSchedule: boolean;
  prerequisiteMessages: PrerequisiteMessage[];
  onNavigate: (tab: Exclude<PlannerTab, "schedule">) => void;
  onAlgorithmChange: (algorithm: ScheduleAlgorithm) => void;
  onStartDateChange: (startDate: string) => void;
  onGenerateSchedule: () => Promise<boolean>;
  onDownloadIcal: () => Promise<boolean>;
}

export function PlannerScheduleStep({
  availability,
  gameListName,
  gameCount,
  totalSelectedHours,
  weeklyHours,
  algorithm,
  startDate,
  schedule,
  actionError,
  canGenerateSchedule,
  prerequisiteMessages,
  onNavigate,
  onAlgorithmChange,
  onStartDateChange,
  onGenerateSchedule,
  onDownloadIcal,
}: Props) {
  const { language, t } = useLanguage();
  const prerequisitesDescriptionId = "schedule-prerequisites";
  const [isGenerating, setIsGenerating] = useState(false);
  const feedback = useTransientFeedback<"success">();
  const readableStartDate = formatReadableDate(startDate, language);

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
              <CalendarRange
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
              onInput={(event) =>
                onStartDateChange((event.target as HTMLInputElement).value)
              }
            />
            <span class="ui-hint">
              {t.schedule.startsOn(readableStartDate)}
            </span>
          </Field>

          <Field label={t.schedule.algorithm} controlId="schedule-algorithm">
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
                <LoaderCircle
                  class="planner-icon planner-icon--spin"
                  aria-hidden="true"
                />
              ) : feedback.active === "success" ? (
                <Check class="planner-icon" aria-hidden="true" />
              ) : (
                <Sparkles class="planner-icon" aria-hidden="true" />
              )}
              {isGenerating
                ? t.schedule.generating
                : feedback.active === "success"
                  ? t.schedule.generated
                  : t.schedule.generate}
            </Button>
          </div>
        </div>

        <p class="planner-controls__hint">
          {schedule
            ? t.schedule.resultClearedHint
            : availability
              ? t.schedule.changeHint
              : t.schedule.availabilityHint}
        </p>

        {prerequisiteMessages.length > 0 && (
          <div id={prerequisitesDescriptionId} class="planner-inline-notice">
            <p class="planner-inline-notice__label">
              <AlertCircle
                class="planner-icon planner-inline-notice__icon"
                aria-hidden="true"
              />
              <span>{t.schedule.before}</span>
            </p>
            <ul class="planner-inline-notice__list">
              {prerequisiteMessages.map((prerequisite) => (
                <li key={prerequisite.id}>
                  <a
                    href={`#planner-panel-${prerequisite.target}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(prerequisite.target);
                      const destinationTab = document.getElementById(
                        `planner-tab-${prerequisite.target}`,
                      );
                      if (destinationTab instanceof HTMLButtonElement) {
                        destinationTab.focus();
                      }
                    }}
                  >
                    {prerequisite.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actionError && (
          <p role="alert" class="planner-error">
            {actionError}
          </p>
        )}

        <div class="planner-algorithm-explanations">
          <div>
            <p class="planner-option-card__label">{t.schedule.sequential}</p>
            <p class="planner-section-heading__text">
              {t.schedule.sequentialCopy}
            </p>
          </div>
          <div>
            <p class="planner-option-card__label">{t.schedule.alternating}</p>
            <p class="planner-section-heading__text">
              {t.schedule.alternatingCopy}
            </p>
          </div>
        </div>

        {canGenerateSchedule && (
          <section
            class="planner-schedule-preview"
            aria-labelledby="schedule-preview-heading"
          >
            <p class="section-eyebrow">{t.schedule.ready}</p>
            <h3 id="schedule-preview-heading">{t.schedule.previewHeading}</h3>
            <dl class="planner-preview-list">
              <div>
                <dt>{t.schedule.previewList}</dt>
                <dd>{gameListName}</dd>
              </div>
              <div>
                <dt>{t.schedule.previewGames}</dt>
                <dd>{t.schedule.games(gameCount)}</dd>
              </div>
              <div>
                <dt>{t.schedule.previewTotal}</dt>
                <dd>{t.schedule.hours(totalSelectedHours)}</dd>
              </div>
              <div>
                <dt>{t.schedule.previewWeekly}</dt>
                <dd>{t.schedule.hoursPerWeek(weeklyHours)}</dd>
              </div>
              <div>
                <dt>{t.schedule.previewStart}</dt>
                <dd>{readableStartDate}</dd>
              </div>
              <div>
                <dt>{t.schedule.previewMethod}</dt>
                <dd>
                  {algorithm === "sequential"
                    ? t.schedule.sequential
                    : t.schedule.alternating}
                </dd>
              </div>
            </dl>
          </section>
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

function formatReadableDate(date: string, language: string): string {
  const parsedDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
}
