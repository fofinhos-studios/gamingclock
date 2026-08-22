import { CalendarIcon, InfoIcon, WarningIcon } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import type {
  ListGame,
  PlanningMode,
  ScheduleAlgorithm,
  ScheduleResponse,
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
  gameListName: string;
  games?: ListGame[];
  excludedGames?: ListGame[];
  gameCount: number;
  totalSelectedHours: number;
  weeklyHours: number;
  algorithm: ScheduleAlgorithm;
  startDate: string;
  planningMode: PlanningMode;
  finishByDate: string | null;
  maxSessionHours: number;
  schedule: ScheduleResponse | null;
  isGenerating: boolean;
  actionError: string;
  canGenerateSchedule: boolean;
  prerequisiteMessages: PrerequisiteMessage[];
  onNavigate: (tab: Exclude<PlannerTab, "schedule">) => void;
  onAlgorithmChange: (algorithm: ScheduleAlgorithm) => void;
  onStartDateChange: (startDate: string) => void;
  onPlanningModeChange: (planningMode: PlanningMode) => void;
  onFinishByDateChange: (finishByDate: string) => void;
  onMaxSessionHoursChange: (maxSessionHours: number) => void;
  onScheduleChange: (schedule: ScheduleResponse) => void;
  onDownloadIcal: () => Promise<boolean>;
  onCopyCalendarUrl: () => Promise<boolean>;
}

export function PlannerScheduleStep({
  gameListName,
  games = [],
  excludedGames = [],
  gameCount,
  totalSelectedHours,
  weeklyHours,
  algorithm,
  startDate,
  planningMode,
  finishByDate,
  maxSessionHours,
  schedule,
  isGenerating,
  actionError,
  canGenerateSchedule,
  prerequisiteMessages,
  onNavigate,
  onAlgorithmChange,
  onStartDateChange,
  onPlanningModeChange,
  onFinishByDateChange,
  onMaxSessionHoursChange,
  onScheduleChange,
  onDownloadIcal,
  onCopyCalendarUrl,
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
  const excludedGameNames = excludedGames.map((game) => game.name).join(", ");
  const hasValidFinishByDate =
    finishByDate !== null && finishByDate >= startDate;

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
          <div class="planner-planning-mode-field">
            <Field label={t.schedule.planningMode} controlId="planning-mode">
              <Select
                id="planning-mode"
                value={planningMode}
                onChange={(event) =>
                  onPlanningModeChange(
                    (event.target as HTMLSelectElement).value as PlanningMode,
                  )
                }
              >
                <option value="weekly">{t.schedule.weeklyMode}</option>
                <option value="finish_by">{t.schedule.finishByMode}</option>
              </Select>
            </Field>
            <Button
              unstyled
              class="planner-planning-mode-field__hint"
              aria-label={t.schedule.planningModeHint}
              data-tooltip={t.schedule.planningModeHint}
            >
              <InfoIcon class="planner-icon" aria-hidden="true" />
            </Button>
          </div>
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

          {planningMode === "finish_by" && (
            <Field
              label={t.schedule.finishByDate}
              controlId="schedule-finish-by-date"
            >
              <Input
                id="schedule-finish-by-date"
                type="date"
                min={startDate}
                value={finishByDate ?? ""}
                onInput={(event) =>
                  onFinishByDateChange((event.target as HTMLInputElement).value)
                }
              />
            </Field>
          )}

          {planningMode === "finish_by" && (
            <Field
              label={t.schedule.maxSessionHours}
              controlId="schedule-max-session-hours"
            >
              <Input
                id="schedule-max-session-hours"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={String(maxSessionHours)}
                onInput={(event) => {
                  const value = Number(
                    (event.target as HTMLInputElement).value,
                  );
                  if (Number.isFinite(value) && value > 0) {
                    onMaxSessionHoursChange(value);
                  }
                }}
              />
            </Field>
          )}

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

        {planningMode === "finish_by" && !hasValidFinishByDate && (
          <p class="planner-inline-notice">{t.schedule.finishByRequired}</p>
        )}

        {planningMode === "finish_by" && hasValidFinishByDate && (
          <p class="planner-mode-guidance">{t.schedule.finishByGuidance}</p>
        )}

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

        {excludedGames.length > 0 && (
          <aside class="planner-inline-notice planner-inline-notice--warning">
            <WarningIcon
              class="planner-inline-notice__icon planner-icon"
              aria-hidden="true"
            />
            <p>
              {t.schedule.excludedGames(
                excludedGameNames,
                excludedGames.length,
              )}
            </p>
          </aside>
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
                <dt>
                  {planningMode === "finish_by"
                    ? t.schedule.previewSessionCap
                    : t.schedule.previewWeekly}
                </dt>
                <dd>
                  {planningMode === "finish_by"
                    ? t.schedule.hours(maxSessionHours)
                    : t.schedule.hoursPerWeek(weeklyHours)}
                </dd>
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
              {planningMode === "finish_by" && finishByDate && (
                <div>
                  <dt>{t.schedule.finishByDate}</dt>
                  <dd>{formatReadableDate(finishByDate, language)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>

      {schedule && (
        <div class="planner-pane">
          <ScheduleView
            schedule={schedule}
            games={games}
            finishByDate={planningMode === "finish_by" ? finishByDate : null}
            onScheduleChange={onScheduleChange}
            onDownloadIcal={onDownloadIcal}
            onCopyCalendarUrl={onCopyCalendarUrl}
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
