import { CalendarIcon, InfoIcon } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import type { ListGame, ScheduleAlgorithm, ScheduleResponse } from "../types";
import type { PlannerTab } from "./planner-tabs";
import { ScheduleView } from "./schedule-view";
import { Button, Field, Input, Select } from "./ui";

interface PrerequisiteMessage {
  id: string;
  message: string;
  target: Exclude<PlannerTab, "schedule">;
}

interface Props {
  gameListName: string;
  games?: ListGame[];
  gameCount: number;
  totalSelectedHours: number;
  weeklyHours: number;
  algorithm: ScheduleAlgorithm;
  startDate: string;
  schedule: ScheduleResponse | null;
  isGenerating: boolean;
  actionError: string;
  canGenerateSchedule: boolean;
  prerequisiteMessages: PrerequisiteMessage[];
  onNavigate: (tab: Exclude<PlannerTab, "schedule">) => void;
  onAlgorithmChange: (algorithm: ScheduleAlgorithm) => void;
  onStartDateChange: (startDate: string) => void;
  onDownloadIcal: () => Promise<boolean>;
}

export function PlannerScheduleStep({
  gameListName,
  games = [],
  gameCount,
  totalSelectedHours,
  weeklyHours,
  algorithm,
  startDate,
  schedule,
  isGenerating,
  actionError,
  canGenerateSchedule,
  prerequisiteMessages,
  onNavigate,
  onAlgorithmChange,
  onStartDateChange,
  onDownloadIcal,
}: Props) {
  const { language, t } = useLanguage();
  const prerequisitesDescriptionId = "schedule-prerequisites";
  const readableStartDate = formatReadableDate(startDate, language);
  const algorithmName =
    algorithm === "sequential" ? t.schedule.sequential : t.schedule.alternating;
  const algorithmExplanation =
    algorithm === "sequential"
      ? t.schedule.sequentialCopy
      : t.schedule.alternatingCopy;

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
              onInput={(event) =>
                onStartDateChange((event.target as HTMLInputElement).value)
              }
            />
          </Field>

          <div class="planner-algorithm-field">
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
            <Button
              unstyled
              class="planner-algorithm-field__hint"
              aria-label={`${algorithmName}: ${algorithmExplanation}`}
              data-tooltip={algorithmExplanation}
            >
              <InfoIcon class="planner-icon" aria-hidden="true" />
            </Button>
          </div>

          {isGenerating && (
            <output aria-live="polite">{t.schedule.generating}</output>
          )}
        </div>

        {prerequisiteMessages.length > 0 && (
          <output id={prerequisitesDescriptionId} class="planner-inline-notice">
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
          </output>
        )}

        {actionError && (
          <p role="alert" class="planner-error">
            {actionError}
          </p>
        )}

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
          <ScheduleView
            schedule={schedule}
            games={games}
            onDownloadIcal={onDownloadIcal}
          />
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
