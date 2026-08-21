import {
  CalendarIcon,
  CheckIcon,
  CircleNotchIcon,
  ClockIcon,
  DownloadSimpleIcon,
  FlagIcon,
  HourglassIcon,
  RowsIcon,
} from "@phosphor-icons/react";
import { useState } from "preact/hooks";
import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import type { ScheduleResponse } from "../types";
import { Button } from "./ui";

interface Props {
  schedule: ScheduleResponse;
  onDownloadIcal: () => Promise<boolean>;
}

function calculateElapsedDays(schedule: ScheduleResponse): number | null {
  const firstSessionDate = schedule.sessions[0]?.date;
  const lastDate = schedule.sessions.at(-1)?.date;

  if (!firstSessionDate || !lastDate) {
    return null;
  }

  const start = new Date(`${firstSessionDate}T00:00:00Z`);
  const end = new Date(`${lastDate}T00:00:00Z`);
  const differenceInDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return differenceInDays >= 0 ? differenceInDays + 1 : null;
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

export function ScheduleView({ schedule, onDownloadIcal }: Props) {
  const { language, t } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);
  const feedback = useTransientFeedback<"success">();

  if (schedule.sessions.length === 0) {
    return (
      <section>
        <p>{t.schedule.noSessions}</p>
      </section>
    );
  }

  const totalElapsedDays = calculateElapsedDays(schedule);

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    const success = await onDownloadIcal();
    setIsDownloading(false);
    if (success) {
      feedback.trigger("success", 1800);
    } else {
      feedback.clear();
    }
  };

  return (
    <section aria-labelledby="schedule-heading" class="space-y-4">
      <div class="planner-pane__header">
        <div class="space-y-1">
          <h2
            id="schedule-heading"
            class="planner-panel__title planner-heading"
          >
            <CalendarIcon
              class="planner-icon planner-heading__icon"
              aria-hidden="true"
            />
            <span>{t.schedule.generatedHeading}</span>
          </h2>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleDownloadClick()}
          disabled={isDownloading}
          feedbackState={
            isDownloading
              ? "loading"
              : feedback.active === "success"
                ? "success"
                : "idle"
          }
        >
          {isDownloading ? (
            <CircleNotchIcon
              class="planner-icon planner-icon--spin"
              aria-hidden="true"
            />
          ) : feedback.active === "success" ? (
            <CheckIcon class="planner-icon" aria-hidden="true" />
          ) : (
            <DownloadSimpleIcon class="planner-icon" aria-hidden="true" />
          )}
          {isDownloading
            ? t.schedule.downloading
            : feedback.active === "success"
              ? t.schedule.downloaded
              : t.schedule.download}
        </Button>
      </div>

      <div class="planner-metric-grid">
        <div class="planner-metric">
          <p class="planner-metric__label">
            <HourglassIcon
              class="planner-icon planner-metric__icon"
              aria-hidden="true"
            />
            <span>{t.schedule.totalHours}</span>
          </p>
          <p class="planner-metric__value">{schedule.total_hours.toFixed(1)}</p>
        </div>
        <div class="planner-metric">
          <p class="planner-metric__label">
            <FlagIcon
              class="planner-icon planner-metric__icon"
              aria-hidden="true"
            />
            <span>{t.schedule.estimatedFinish}</span>
          </p>
          <p class="planner-metric__value">
            {schedule.estimated_end_date
              ? formatReadableDate(schedule.estimated_end_date, language)
              : t.schedule.unavailable}
          </p>
        </div>
        <div class="planner-metric">
          <p class="planner-metric__label">
            <RowsIcon
              class="planner-icon planner-metric__icon"
              aria-hidden="true"
            />
            <span>{t.schedule.sessions}</span>
          </p>
          <p class="planner-metric__value">{schedule.sessions.length}</p>
        </div>
        {totalElapsedDays !== null && (
          <div class="planner-metric">
            <p class="planner-metric__label">
              <ClockIcon
                class="planner-icon planner-metric__icon"
                aria-hidden="true"
              />
              <span>{t.schedule.elapsed}</span>
            </p>
            <p class="planner-metric__value">
              {t.schedule.days(totalElapsedDays)}
            </p>
          </div>
        )}
      </div>

      <div class="space-y-3">
        <p class="section-eyebrow">{t.schedule.timeline}</p>
        <ol class="timeline">
          {schedule.sessions.map((session, index) => (
            <li key={`${session.game_name}-${session.date}-${index}`}>
              <article class="timeline-entry">
                <div class="timeline-entry__header">
                  <p class="timeline-meta">
                    {t.schedule.starts(
                      formatReadableDate(session.date, language),
                      session.start_time,
                    )}
                  </p>
                  <p class="timeline-duration">
                    {session.duration_hours.toFixed(1)}h
                  </p>
                </div>
                <h3 class="timeline-title">{session.game_name}</h3>
                <p class="timeline-detail">
                  {t.schedule.plannedHours(session.duration_hours.toFixed(1))}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
