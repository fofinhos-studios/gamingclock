import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { useLanguage } from "../i18n/i18n";
import type {
  DayAvailability,
  PlanningMode,
  WeeklyAvailability,
} from "../types";
import { Button } from "./ui";

const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const SLOT_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_START_MINUTES = 20 * 60;

type CalendarEvent = {
  day: number;
  durationMinutes: number;
  id: string;
  startMinutes: number;
};

type EventDragState = {
  durationMinutes: number;
  eventId: string;
  mode: "move" | "resize";
  offsetMinutes: number;
};

type CreateDragState = {
  day: number;
  eventId: string;
  mode: "create";
  startMinutes: number;
};

type DragState = CreateDragState | EventDragState;

interface Props {
  availability: WeeklyAvailability | null;
  planningMode?: PlanningMode;
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
  return (availability?.days ?? []).map((day, index): CalendarEvent => {
    const durationMinutes = Math.min(
      END_MINUTES - START_MINUTES,
      Math.max(SLOT_MINUTES, Math.round(day.hours * 60)),
    );

    return {
      day: day.day_of_week,
      durationMinutes,
      id: `saved-${index}-${day.day_of_week}-${day.start_hour}-${day.start_minute ?? 0}`,
      startMinutes: clampStart(
        day.start_hour * 60 + (day.start_minute ?? 0),
        durationMinutes,
      ),
    };
  });
}

function availabilityFromEvents(
  events: CalendarEvent[],
): WeeklyAvailability | null {
  const days = events
    .map(
      (event): DayAvailability => ({
        day_of_week: event.day,
        hours: event.durationMinutes / 60,
        start_hour: Math.floor(event.startMinutes / 60),
        start_minute: event.startMinutes % 60,
      }),
    )
    .sort(
      (left, right) =>
        left.day_of_week - right.day_of_week ||
        left.start_hour - right.start_hour ||
        (left.start_minute ?? 0) - (right.start_minute ?? 0),
    );

  return days.length > 0 ? { days } : null;
}

function availabilityMatches(
  left: WeeklyAvailability | null,
  right: WeeklyAvailability | null,
) {
  if (left === right) {
    return true;
  }
  if (
    left === null ||
    right === null ||
    left.days.length !== right.days.length
  ) {
    return false;
  }

  return left.days.every((day, index) => {
    const other = right.days[index];
    return (
      day.day_of_week === other.day_of_week &&
      day.hours === other.hours &&
      day.start_hour === other.start_hour &&
      (day.start_minute ?? 0) === (other.start_minute ?? 0)
    );
  });
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

function overlaps(
  events: CalendarEvent[],
  candidate: Omit<CalendarEvent, "id">,
  ignoredId?: string,
) {
  const candidateEnd = candidate.startMinutes + candidate.durationMinutes;
  return events.some(
    (event) =>
      event.id !== ignoredId &&
      event.day === candidate.day &&
      event.startMinutes < candidateEnd &&
      candidate.startMinutes < event.startMinutes + event.durationMinutes,
  );
}

function maxDurationForEvent(events: CalendarEvent[], event: CalendarEvent) {
  const nextEventStart = events
    .filter(
      (other) =>
        other.id !== event.id &&
        other.day === event.day &&
        other.startMinutes >= event.startMinutes,
    )
    .reduce(
      (closest, other) => Math.min(closest, other.startMinutes),
      END_MINUTES,
    );

  return nextEventStart - event.startMinutes;
}

export function AvailabilityForm({
  availability,
  planningMode = "weekly",
  onChange,
}: Props) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    eventsFromAvailability(availability),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const didCreateDrag = useRef(false);
  const lastEmittedAvailability = useRef<WeeklyAvailability | null | undefined>(
    undefined,
  );
  const nextEventId = useRef(0);
  const slots = Array.from(
    { length: (END_MINUTES - START_MINUTES) / SLOT_MINUTES },
    (_, index) => START_MINUTES + index * SLOT_MINUTES,
  );

  useEffect(() => {
    if (
      lastEmittedAvailability.current !== undefined &&
      availabilityMatches(availability, lastEmittedAvailability.current)
    ) {
      lastEmittedAvailability.current = undefined;
      return;
    }

    setEvents(eventsFromAvailability(availability));
  }, [availability]);

  const emitEvents = useCallback(
    (next: CalendarEvent[]) => {
      const nextAvailability = availabilityFromEvents(next);
      lastEmittedAvailability.current = nextAvailability;
      onChange(nextAvailability);
      return next;
    },
    [onChange],
  );

  useLayoutEffect(() => {
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
        if (dragState.mode === "create") {
          if (targetDay !== dragState.day) {
            return current;
          }

          const startMinutes = Math.min(dragState.startMinutes, pointerMinutes);
          const durationMinutes = Math.max(
            SLOT_MINUTES,
            Math.abs(pointerMinutes - dragState.startMinutes),
          );
          const candidate = {
            day: dragState.day,
            durationMinutes,
            startMinutes,
          };
          if (overlaps(current, candidate, dragState.eventId)) {
            return current;
          }

          didCreateDrag.current ||= pointerMinutes !== dragState.startMinutes;
          const nextEvent: CalendarEvent = {
            ...candidate,
            id: dragState.eventId,
          };
          const next = current.some(
            (calendarEvent) => calendarEvent.id === dragState.eventId,
          )
            ? current.map((calendarEvent) =>
                calendarEvent.id === dragState.eventId
                  ? nextEvent
                  : calendarEvent,
              )
            : [...current, nextEvent];
          return emitEvents(next);
        }

        const source = current.find(
          (calendarEvent) => calendarEvent.id === dragState.eventId,
        );
        if (!source) {
          return current;
        }

        if (dragState.mode === "resize") {
          const durationMinutes = Math.max(
            SLOT_MINUTES,
            Math.min(
              maxDurationForEvent(current, source),
              pointerMinutes - source.startMinutes,
            ),
          );
          const next = current.map((calendarEvent) =>
            calendarEvent.id === source.id
              ? { ...source, durationMinutes }
              : calendarEvent,
          );
          return emitEvents(next);
        }

        const startMinutes = clampStart(
          pointerMinutes - dragState.offsetMinutes,
          dragState.durationMinutes,
        );
        const candidate = {
          day: targetDay,
          durationMinutes: dragState.durationMinutes,
          startMinutes,
        };
        if (overlaps(current, candidate, source.id)) {
          return current;
        }

        const next = current.map((calendarEvent) =>
          calendarEvent.id === source.id
            ? { ...candidate, id: source.id }
            : calendarEvent,
        );
        return emitEvents(next);
      });
    };

    const handlePointerUp = () => setDragState(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, emitEvents]);

  const commitEvents = (next: CalendarEvent[]) => {
    setEvents(next);
    emitEvents(next);
  };

  const addEvent = (day: number, startMinutes: number) => {
    const candidate = {
      day,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      startMinutes: clampStart(startMinutes, DEFAULT_DURATION_MINUTES),
    };
    if (overlaps(events, candidate)) {
      return;
    }

    commitEvents([
      ...events,
      { ...candidate, id: `new-${nextEventId.current++}` },
    ]);
  };

  const applyPreset = (days: number[]) => {
    commitEvents(
      days.map((day) => ({
        day,
        durationMinutes: 2 * 60,
        id: `preset-${nextEventId.current++}`,
        startMinutes: DEFAULT_START_MINUTES,
      })),
    );
  };

  const startDragging = (
    event: PointerEvent,
    eventId: string,
    mode: EventDragState["mode"],
  ) => {
    (event.currentTarget as HTMLElement).focus();
    event.preventDefault();
    event.stopPropagation();
    const calendarEvent = events.find((candidate) => candidate.id === eventId);
    const column = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-week-day]",
    );
    if (!calendarEvent || !column) {
      return;
    }

    const pointerMinutes = getMinutesFromPointer(event, column);
    setDragState({
      durationMinutes: calendarEvent.durationMinutes,
      eventId,
      mode,
      offsetMinutes:
        mode === "move" && pointerMinutes !== null
          ? pointerMinutes - calendarEvent.startMinutes
          : 0,
    });
  };

  const startCreating = (
    event: PointerEvent,
    day: number,
    startMinutes: number,
  ) => {
    (event.currentTarget as HTMLElement).focus();
    event.preventDefault();
    didCreateDrag.current = false;
    setDragState({
      day,
      eventId: `new-${nextEventId.current++}`,
      mode: "create",
      startMinutes,
    });
  };

  const moveWithKeyboard = (
    eventId: string,
    direction: -1 | 1,
    resize = false,
  ) => {
    const calendarEvent = events.find((event) => event.id === eventId);
    if (!calendarEvent) {
      return;
    }

    const nextEvent = resize
      ? {
          ...calendarEvent,
          durationMinutes: Math.max(
            SLOT_MINUTES,
            Math.min(
              maxDurationForEvent(events, calendarEvent),
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

    if (overlaps(events, nextEvent, calendarEvent.id)) {
      return;
    }

    commitEvents(
      events.map((event) => (event.id === eventId ? nextEvent : event)),
    );
  };

  const totalMinutes = events.reduce(
    (total, event) => total + event.durationMinutes,
    0,
  );

  return (
    <section
      class={`availability-week${planningMode === "finish_by" ? " availability-week--finish-by" : ""}`}
      aria-labelledby="availability-heading"
    >
      <h3 id="availability-heading" class="sr-only">
        {t.availability.form.heading}
      </h3>

      <div class="availability-week__toolbar">
        <div>
          <p class="availability-week__copy">
            {planningMode === "finish_by"
              ? t.availability.form.finishByCalendarCopy
              : t.availability.form.calendarCopy}
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
          <Button type="button" size="sm" onClick={() => commitEvents([])}>
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
            const dayEvents = events
              .filter((event) => event.day === dayIndex)
              .sort((left, right) => left.startMinutes - right.startMinutes);
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
                      onClick={() => {
                        if (didCreateDrag.current) {
                          didCreateDrag.current = false;
                          return;
                        }
                        addEvent(dayIndex, minutes);
                      }}
                      onPointerDown={(event) =>
                        startCreating(event, dayIndex, minutes)
                      }
                    />
                  ))}
                </div>
                {dayEvents.map((calendarEvent) => (
                  <button
                    key={calendarEvent.id}
                    type="button"
                    class="availability-week__event"
                    aria-label={`${day}, ${formatDuration(calendarEvent.durationMinutes)} from ${formatTime(calendarEvent.startMinutes)}`}
                    style={{
                      top: `${((calendarEvent.startMinutes - START_MINUTES) / (END_MINUTES - START_MINUTES)) * 100}%`,
                      height: `${(calendarEvent.durationMinutes / (END_MINUTES - START_MINUTES)) * 100}%`,
                    }}
                    onPointerDown={(event) =>
                      startDragging(event, calendarEvent.id, "move")
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        moveWithKeyboard(
                          calendarEvent.id,
                          event.key === "ArrowUp" ? -1 : 1,
                          event.shiftKey,
                        );
                      }
                      if (event.key === "Delete" || event.key === "Backspace") {
                        event.preventDefault();
                        commitEvents(
                          events.filter(
                            (candidate) => candidate.id !== calendarEvent.id,
                          ),
                        );
                      }
                    }}
                  >
                    <span>{formatDuration(calendarEvent.durationMinutes)}</span>
                    <span>{formatTime(calendarEvent.startMinutes)}</span>
                    <span
                      class="availability-week__resize-handle"
                      aria-hidden="true"
                      onPointerDown={(event) =>
                        startDragging(event, calendarEvent.id, "resize")
                      }
                    />
                  </button>
                ))}
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
