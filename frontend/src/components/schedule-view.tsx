import {
  CalendarIcon,
  CheckIcon,
  CircleNotchIcon,
  ClockIcon,
  DownloadSimpleIcon,
  FlagIcon,
  HourglassIcon,
  RowsIcon,
  WarningIcon,
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
  finishByDate?: string | null;
  onScheduleChange: (schedule: ScheduleResponse) => void;
  onDownloadIcal: () => Promise<boolean>;
}

function calculateElapsedDays(schedule: ScheduleResponse): number | null {
  const sessionDates = schedule.sessions.map((session) => session.date).sort();
  const firstSessionDate = sessionDates[0];
  const lastDate = sessionDates.at(-1);

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

interface CalendarDay {
  date: string;
  isCurrentMonth: boolean;
  sessions: CalendarSession[];
}

interface CalendarSession {
  index: number;
  session: PlaySession;
}

interface CalendarMonth {
  month: Date;
  days: CalendarDay[];
}

function getCalendarMonths(sessions: PlaySession[]): CalendarMonth[] {
  const sessionsByDate = new Map<string, CalendarSession[]>();
  for (const [index, session] of sessions.entries()) {
    sessionsByDate.set(session.date, [
      ...(sessionsByDate.get(session.date) ?? []),
      { index, session },
    ]);
  }

  const sessionDates = [...sessionsByDate.keys()].sort();
  const first = new Date(`${sessionDates[0]}T12:00:00Z`);
  const last = new Date(`${sessionDates.at(-1)}T12:00:00Z`);
  const firstMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1),
  );
  const lastMonth = new Date(
    Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1),
  );
  const months: CalendarMonth[] = [];

  for (
    const month = new Date(firstMonth);
    month <= lastMonth;
    month.setUTCMonth(month.getUTCMonth() + 1)
  ) {
    const firstMonday = new Date(month);
    firstMonday.setUTCDate(month.getUTCDate() - ((month.getUTCDay() + 6) % 7));
    const lastDayOfMonth = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    );
    const lastSunday = new Date(lastDayOfMonth);
    lastSunday.setUTCDate(
      lastDayOfMonth.getUTCDate() +
        (6 - ((lastDayOfMonth.getUTCDay() + 6) % 7)),
    );

    const days: CalendarDay[] = [];
    for (
      const day = new Date(firstMonday);
      day <= lastSunday;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const date = day.toISOString().slice(0, 10);
      days.push({
        date,
        isCurrentMonth: day.getUTCMonth() === month.getUTCMonth(),
        sessions:
          day.getUTCMonth() === month.getUTCMonth()
            ? (sessionsByDate.get(date) ?? [])
            : [],
      });
    }

    months.push({ month: new Date(month), days });
  }

  return months;
}

export function ScheduleView({
  schedule,
  games = [],
  finishByDate = null,
  onScheduleChange,
  onDownloadIcal,
}: Props) {
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
  const calendarMonths = getCalendarMonths(schedule.sessions);
  const weekDayFormatter = new Intl.DateTimeFormat(language, {
    weekday: "short",
    timeZone: "UTC",
  });
  const monthFormatter = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const weekdayDates = Array.from(
    { length: 7 },
    (_, index) => new Date(Date.UTC(2024, 0, index + 1)),
  );
  const missesDeadline =
    finishByDate !== null &&
    schedule.sessions.some((session) => session.date > finishByDate);

  const moveSession = (index: number, date: string) => {
    const currentSession = schedule.sessions[index];
    if (!currentSession || currentSession.date === date) {
      return;
    }
    const sessions = schedule.sessions.map((session, sessionIndex) =>
      sessionIndex === index ? { ...session, date } : session,
    );
    const estimatedEndDate = sessions.reduce<string | null>(
      (latest, session) =>
        !latest || session.date > latest ? session.date : latest,
      null,
    );
    onScheduleChange({
      ...schedule,
      sessions,
      estimated_end_date: estimatedEndDate,
    });
  };

  const moveSessionByDays = (index: number, days: number) => {
    const session = schedule.sessions[index];
    if (!session) {
      return;
    }
    const date = new Date(`${session.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    moveSession(index, date.toISOString().slice(0, 10));
  };

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

      {missesDeadline && (
        <output class="planner-inline-notice planner-inline-notice--warning">
          <WarningIcon
            class="planner-inline-notice__icon planner-icon"
            aria-hidden="true"
          />
          <p>{t.schedule.deadlineMissed}</p>
        </output>
      )}

      <div class="schedule-calendar-section">
        <p class="section-eyebrow">{t.schedule.timeline}</p>
        <p class="schedule-calendar__move-copy">{t.schedule.moveSessions}</p>
        <div class="schedule-calendar" aria-label={t.schedule.timeline}>
          {calendarMonths.map(({ month, days }) => (
            <section
              key={month.toISOString()}
              class="schedule-calendar__month"
              aria-labelledby={`schedule-month-${month.getUTCFullYear()}-${month.getUTCMonth()}`}
            >
              <h3
                id={`schedule-month-${month.getUTCFullYear()}-${month.getUTCMonth()}`}
                class="schedule-calendar__month-title"
              >
                {monthFormatter.format(month)}
              </h3>
              <div class="schedule-calendar__grid">
                {weekdayDates.map((date) => (
                  <div
                    key={date.toISOString()}
                    class="schedule-calendar__weekday"
                  >
                    {weekDayFormatter.format(date)}
                  </div>
                ))}
                {days.map((day) => {
                  const date = new Date(`${day.date}T12:00:00Z`);
                  const gameSessions = day.sessions.map(
                    ({ session, index }) => {
                      const game = games.find(
                        (candidate) =>
                          candidate.name.toLocaleLowerCase() ===
                          session.game_name.toLocaleLowerCase(),
                      );
                      const card = game ? (
                        <GameCartridge
                          game={game}
                          plannedHours={session.duration_hours}
                          startTime={session.start_time}
                          variant="calendar"
                        />
                      ) : (
                        <div class="schedule-calendar__session-fallback">
                          <strong>{session.game_name}</strong>
                          <span>{session.duration_hours.toFixed(1)}h</span>
                        </div>
                      );

                      return (
                        <button
                          key={`${session.game_name}-${session.date}-${session.start_time}-${index}`}
                          class="schedule-calendar__session-move"
                          type="button"
                          draggable
                          aria-label={t.schedule.moveSession(session.game_name)}
                          onDragStart={(event) =>
                            event.dataTransfer?.setData(
                              "text/plain",
                              String(index),
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "ArrowLeft") {
                              event.preventDefault();
                              moveSessionByDays(index, -1);
                            }
                            if (event.key === "ArrowRight") {
                              event.preventDefault();
                              moveSessionByDays(index, 1);
                            }
                          }}
                        >
                          {card}
                        </button>
                      );
                    },
                  );

                  return (
                    <div
                      key={day.date}
                      class={`schedule-calendar__day${
                        day.sessions.length === 0
                          ? " schedule-calendar__day--empty"
                          : ""
                      }${
                        day.isCurrentMonth
                          ? ""
                          : " schedule-calendar__day--adjacent"
                      }`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const index = Number(
                          event.dataTransfer?.getData("text/plain"),
                        );
                        if (Number.isInteger(index)) {
                          moveSession(index, day.date);
                        }
                      }}
                    >
                      <div class="schedule-calendar__date">
                        <time
                          dateTime={day.date}
                          aria-label={formatReadableDate(day.date, language)}
                        >
                          {date.getUTCDate()}
                        </time>
                      </div>
                      <div class="schedule-calendar__sessions">
                        {gameSessions}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
