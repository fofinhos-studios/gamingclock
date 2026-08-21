import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "preact/hooks";

import { useLanguage } from "../i18n/i18n";
import type { DayAvailability, WeeklyAvailability } from "../types";
import { Button } from "./ui";

const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const SLOT_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_START_MINUTES = 20 * 60;

type CalendarEvent = {
  durationMinutes: number;
  startMinutes: number;
};

type CalendarEvents = Record<number, CalendarEvent>;

type DragState = {
  day: number;
  durationMinutes: number;
  mode: "move" | "resize";
  offsetMinutes: number;
};

interface Props {
  availability: WeeklyAvailability | null;
  onChange: (availability: WeeklyAvailability | null) => void;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${hours.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

function clampStart(startMinutes: number, durationMinutes: number) {
  return Math.max(
    START_MINUTES,
    Math.min(END_MINUTES - durationMinutes, startMinutes),
  );
}

function snapMinutes(minutes: number) {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

function eventsFromAvailability(availability: WeeklyAvailability | null) {
  return (availability?.days ?? []).reduce<CalendarEvents>((events, day) => {
    const durationMinutes = Math.min(
      END_MINUTES - START_MINUTES,
      Math.max(SLOT_MINUTES, Math.round(day.hours * 60)),
    );
    const startMinutes = clampStart(
      day.start_hour * 60 + (day.start_minute ?? 0),
      durationMinutes,
    );

    events[day.day_of_week] = { durationMinutes, startMinutes };
    return events;
  }, {});
}

function availabilityFromEvents(
  events: CalendarEvents,
): WeeklyAvailability | null {
  const days = Object.entries(events)
    .map(
      ([day, event]): DayAvailability => ({
        day_of_week: Number(day),
        hours: event.durationMinutes / 60,
        start_hour: Math.floor(event.startMinutes / 60),
        start_minute: event.startMinutes % 60,
      }),
    )
    .sort((left, right) => left.day_of_week - right.day_of_week);

  return days.length > 0 ? { days } : null;
}

function getMinutesFromPointer(event: PointerEvent, column: HTMLElement) {
  const bounds = column.getBoundingClientRect();
  if (bounds.height === 0) {
    return null;
  }

  const progress = Math.max(
    0,
    Math.min(1, (event.clientY - bounds.top) / bounds.height),
  );
  return snapMinutes(START_MINUTES + progress * (END_MINUTES - START_MINUTES));
}

export function AvailabilityForm({ availability, onChange }: Props) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<CalendarEvents>(() =>
    eventsFromAvailability(availability),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const slots = Array.from(
    { length: (END_MINUTES - START_MINUTES) / SLOT_MINUTES },
    (_, index) => START_MINUTES + index * SLOT_MINUTES,
  );

  useEffect(() => {
    setEvents(eventsFromAvailability(availability));
  }, [availability]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-week-day]");
      if (!target) {
        return;
      }

      const targetDay = Number(target.dataset.weekDay);
      const pointerMinutes = getMinutesFromPointer(event, target);
      if (!Number.isInteger(targetDay) || pointerMinutes === null) {
        return;
      }

      setEvents((current) => {
        const source = current[dragState.day];
        if (!source) {
          return current;
        }

        if (dragState.mode === "resize") {
          const durationMinutes = Math.max(
            SLOT_MINUTES,
            Math.min(
              END_MINUTES - source.startMinutes,
              pointerMinutes - source.startMinutes,
            ),
          );
          const next = {
            ...current,
            [dragState.day]: {
              ...source,
              durationMinutes,
            },
          };
          onChange(availabilityFromEvents(next));
          return next;
        }

        const startMinutes = clampStart(
          pointerMinutes - dragState.offsetMinutes,
          dragState.durationMinutes,
        );
        const targetEvent = current[targetDay];
        const next = {
          ...current,
          [targetDay]: {
            startMinutes,
            durationMinutes: dragState.durationMinutes,
          },
        };

        if (targetDay !== dragState.day) {
          if (targetEvent) {
            next[dragState.day] = targetEvent;
          } else {
            delete next[dragState.day];
          }
        }

        onChange(availabilityFromEvents(next));
        return next;
      });
    };

    const handlePointerUp = () => setDragState(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, onChange]);

  const commitEvents = (next: CalendarEvents) => {
    setEvents(next);
    onChange(availabilityFromEvents(next));
  };

  const addEvent = (day: number, startMinutes: number) => {
    if (events[day]) {
      return;
    }
    commitEvents({
      ...events,
      [day]: {
        startMinutes: clampStart(startMinutes, DEFAULT_DURATION_MINUTES),
        durationMinutes: DEFAULT_DURATION_MINUTES,
      },
    });
  };

  const applyPreset = (days: number[]) => {
    const next = Object.fromEntries(
      days.map((day) => [
        day,
        {
          startMinutes: DEFAULT_START_MINUTES,
          durationMinutes: 2 * 60,
        },
      ]),
    );
    commitEvents(next);
  };

  const startDragging = (
    event: PointerEvent,
    day: number,
    mode: DragState["mode"],
  ) => {
    (event.currentTarget as HTMLElement).focus();
    event.preventDefault();
    event.stopPropagation();
    const calendarEvent = events[day];
    const column = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-week-day]",
    );
    if (!calendarEvent || !column) {
      return;
    }

    const pointerMinutes = getMinutesFromPointer(event, column);
    setDragState({
      day,
      durationMinutes: calendarEvent.durationMinutes,
      mode,
      offsetMinutes:
        mode === "move" && pointerMinutes !== null
          ? pointerMinutes - calendarEvent.startMinutes
          : 0,
    });
  };

  const moveWithKeyboard = (day: number, direction: -1 | 1, resize = false) => {
    const calendarEvent = events[day];
    if (!calendarEvent) {
      return;
    }

    const nextEvent = resize
      ? {
          ...calendarEvent,
          durationMinutes: Math.max(
            SLOT_MINUTES,
            Math.min(
              END_MINUTES - calendarEvent.startMinutes,
              calendarEvent.durationMinutes + direction * SLOT_MINUTES,
            ),
          ),
        }
      : {
          ...calendarEvent,
          startMinutes: clampStart(
            calendarEvent.startMinutes + direction * SLOT_MINUTES,
            calendarEvent.durationMinutes,
          ),
        };
    commitEvents({ ...events, [day]: nextEvent });
  };

  const totalMinutes = Object.values(events).reduce(
    (total, event) => total + event.durationMinutes,
    0,
  );

  return (
    <section class="availability-week" aria-labelledby="availability-heading">
      <h3 id="availability-heading" class="sr-only">
        {t.availability.form.heading}
      </h3>

      <div class="availability-week__toolbar">
        <div>
          <p class="section-eyebrow">{t.availability.form.weeklyCalendar}</p>
          <p class="availability-week__copy">
            {t.availability.form.calendarCopy}
          </p>
        </div>
        <div class="availability-week__actions">
          <Button
            type="button"
            size="sm"
            onClick={() => applyPreset([0, 1, 2, 3, 4])}
          >
            {t.availability.form.weeknights}
          </Button>
          <Button type="button" size="sm" onClick={() => applyPreset([5, 6])}>
            {t.availability.form.weekends}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => applyPreset([0, 1, 2, 3, 4, 5, 6])}
          >
            {t.availability.form.everyDay}
          </Button>
          <Button type="button" size="sm" onClick={() => commitEvents({})}>
            {t.availability.form.clearWeek}
          </Button>
        </div>
      </div>

      <div class="availability-week__scroll">
        <div
          class="availability-week__calendar"
          aria-label={t.availability.form.calendarLabel}
        >
          <div class="availability-week__axis" aria-hidden="true" />
          {t.availability.days.map((day) => (
            <div key={day} class="availability-week__day-heading">
              {day}
            </div>
          ))}

          <div class="availability-week__time-labels" aria-hidden="true">
            {slots.map((minutes, index) =>
              minutes % 120 === 0 ? (
                <span key={minutes} style={{ gridRow: index + 1 }}>
                  {minutes === START_MINUTES ? (
                    <SunIcon />
                  ) : minutes === 18 * 60 ? (
                    <MoonIcon />
                  ) : null}
                  {formatTime(minutes)}
                </span>
              ) : null,
            )}
          </div>

          {t.availability.days.map((day, dayIndex) => {
            const calendarEvent = events[dayIndex];
            return (
              <div
                key={day}
                class="availability-week__day"
                data-week-day={dayIndex}
              >
                <div class="availability-week__slots">
                  {slots.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      class="availability-week__slot"
                      aria-label={`${day} at ${formatTime(minutes)}`}
                      onClick={() => addEvent(dayIndex, minutes)}
                    />
                  ))}
                </div>
                {calendarEvent && (
                  <button
                    type="button"
                    class="availability-week__event"
                    aria-label={`${day}, ${formatDuration(calendarEvent.durationMinutes)} from ${formatTime(calendarEvent.startMinutes)}`}
                    style={{
                      top: `${((calendarEvent.startMinutes - START_MINUTES) / (END_MINUTES - START_MINUTES)) * 100}%`,
                      height: `${(calendarEvent.durationMinutes / (END_MINUTES - START_MINUTES)) * 100}%`,
                    }}
                    onPointerDown={(event) =>
                      startDragging(event, dayIndex, "move")
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        moveWithKeyboard(
                          dayIndex,
                          event.key === "ArrowUp" ? -1 : 1,
                          event.shiftKey,
                        );
                      }
                      if (event.key === "Delete" || event.key === "Backspace") {
                        event.preventDefault();
                        const next = { ...events };
                        delete next[dayIndex];
                        commitEvents(next);
                      }
                    }}
                  >
                    <span>{formatDuration(calendarEvent.durationMinutes)}</span>
                    <span>{formatTime(calendarEvent.startMinutes)}</span>
                    <span
                      class="availability-week__resize-handle"
                      aria-hidden="true"
                      onPointerDown={(event) =>
                        startDragging(event, dayIndex, "resize")
                      }
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <output class="availability-week__summary">
        {t.availability.form.weeklyTotal(formatDuration(totalMinutes))}
      </output>
    </section>
  );
}
