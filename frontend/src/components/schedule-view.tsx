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
import type { ListGame, PlaySession, ScheduleResponse } from "../types";
import { GameCartridge } from "./game-cartridge";
import { Button } from "./ui";

interface Props {
  schedule: ScheduleResponse;
  games?: ListGame[];
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

function getCalendarDays(sessions: PlaySession[]) {
  const sessionsByDate = new Map<string, PlaySession[]>();
  for (const session of sessions) {
    sessionsByDate.set(session.date, [
      ...(sessionsByDate.get(session.date) ?? []),
      session,
    ]);
  }

  const first = new Date(`${sessions[0].date}T12:00:00Z`);
  const last = new Date(`${sessions.at(-1)?.date}T12:00:00Z`);
  const firstMonday = new Date(first);
  firstMonday.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const lastSunday = new Date(last);
  lastSunday.setUTCDate(
    last.getUTCDate() + (7 - ((last.getUTCDay() + 6) % 7) - 1),
  );

  const days: Array<{ date: string; sessions: PlaySession[] }> = [];
  for (
    const day = new Date(firstMonday);
    day <= lastSunday;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    days.push({ date, sessions: sessionsByDate.get(date) ?? [] });
  }

  return days;
}

export function ScheduleView({ schedule, games = [], onDownloadIcal }: Props) {
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
  const calendarDays = getCalendarDays(schedule.sessions);
  const weekDayFormatter = new Intl.DateTimeFormat(language, {
    weekday: "short",
    timeZone: "UTC",
  });

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

      <div class="schedule-calendar-section">
        <p class="section-eyebrow">{t.schedule.timeline}</p>
        <div class="schedule-calendar" aria-label={t.schedule.timeline}>
          {calendarDays.map((day) => {
            const date = new Date(`${day.date}T12:00:00Z`);
            const dayContents = (
              <div class="schedule-calendar__day-content">
                <div class="schedule-calendar__date">
                  <span>{weekDayFormatter.format(date)}</span>
                  <strong>{date.getUTCDate()}</strong>
                </div>
                <div class="schedule-calendar__sessions">
                  {day.sessions.map((session, index) => {
                    const game = games.find(
                      (candidate) =>
                        candidate.name.toLocaleLowerCase() ===
                        session.game_name.toLocaleLowerCase(),
                    );
                    return game ? (
                      <GameCartridge
                        key={`${session.game_name}-${index}`}
                        game={game}
                        plannedHours={session.duration_hours}
                        startTime={session.start_time}
                        variant="calendar"
                      />
                    ) : (
                      <div
                        key={`${session.game_name}-${index}`}
                        class="schedule-calendar__session-fallback"
                      >
                        <strong>{session.game_name}</strong>
                        <span>{session.duration_hours.toFixed(1)}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );

            return (
              <div
                key={day.date}
                class={`schedule-calendar__day${
                  day.sessions.length === 0
                    ? " schedule-calendar__day--empty"
                    : ""
                }`}
              >
                {dayContents}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
