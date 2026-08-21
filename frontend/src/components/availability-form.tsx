import { CheckIcon } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import type { DayAvailability, WeeklyAvailability } from "../types";
import { Button, Field, Input, Select } from "./ui";

const MINUTES_PER_HOUR = 60;
const MIN_START_HOUR = 6;
const MAX_START_HOUR = 23;
const MINUTES = Array.from({ length: MINUTES_PER_HOUR }, (_, index) => index);
type ScheduleMode = "uniform" | "custom";

interface Props {
  availability: WeeklyAvailability | null;
  onChange: (availability: WeeklyAvailability | null) => void;
}

function formatStartTime(hour: number, minute = 0): string {
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function parseStartTime(
  value: string,
): { hour: number; minute: number } | null {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute >= MINUTES_PER_HOUR ||
    hour < MIN_START_HOUR ||
    hour > MAX_START_HOUR
  ) {
    return null;
  }

  return { hour, minute };
}

function splitDuration(duration: number) {
  const totalMinutes = Math.max(0, Math.round(duration * MINUTES_PER_HOUR));

  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  };
}

function formatDuration(duration: number): string {
  const { hours, minutes } = splitDuration(duration);

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

interface DurationInputsProps {
  duration: number;
  hoursId: string;
  hoursLabel: string;
  minutesId: string;
  minutesLabel: string;
  onChange: (duration: number) => void;
}

function DurationInputs({
  duration,
  hoursId,
  hoursLabel,
  minutesId,
  minutesLabel,
  onChange,
}: DurationInputsProps) {
  const { hours, minutes } = splitDuration(duration);

  return (
    <>
      <Field label={hoursLabel} controlId={hoursId}>
        <Input
          id={hoursId}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={hours}
          onInput={(event) => {
            const nextHours = Number((event.target as HTMLInputElement).value);
            onChange(
              Number.isFinite(nextHours)
                ? Math.max(0, Math.floor(nextHours)) +
                    minutes / MINUTES_PER_HOUR
                : Number.NaN,
            );
          }}
        />
      </Field>
      <Field label={minutesLabel} controlId={minutesId}>
        <Select
          id={minutesId}
          value={String(minutes)}
          onChange={(event) => {
            onChange(
              hours +
                Number((event.target as HTMLSelectElement).value) /
                  MINUTES_PER_HOUR,
            );
          }}
        >
          {MINUTES.map((minute) => (
            <option key={minute} value={minute}>
              {minute.toString().padStart(2, "0")}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function AvailabilityForm({ availability, onChange }: Props) {
  const { t } = useLanguage();
  const initialDays = availability?.days ?? [];
  const initialHours = initialDays[0]?.hours ?? 2;
  const initialStartTime = formatStartTime(
    initialDays[0]?.start_hour ?? 20,
    initialDays[0]?.start_minute ?? 0,
  );
  const initialScheduleIsUniform = initialDays.every(
    (day) =>
      day.hours === initialHours &&
      formatStartTime(day.start_hour, day.start_minute ?? 0) ===
        initialStartTime,
  );
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    initialScheduleIsUniform ? "uniform" : "custom",
  );
  const [uniformHours, setUniformHours] = useState(initialHours);
  const [uniformStartTime, setUniformStartTime] = useState(initialStartTime);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    new Set(initialDays.map((day) => day.day_of_week)),
  );
  const [customHours, setCustomHours] = useState<Record<number, number>>(
    Object.fromEntries(initialDays.map((day) => [day.day_of_week, day.hours])),
  );
  const [customStartTimes, setCustomStartTimes] = useState<
    Record<number, string>
  >(
    Object.fromEntries(
      initialDays.map((day) => [
        day.day_of_week,
        formatStartTime(day.start_hour, day.start_minute ?? 0),
      ]),
    ),
  );
  const [validationError, setValidationError] = useState("");
  const hasReportedInitialAvailability = useRef(false);
  const scheduleModeFeedback = useTransientFeedback<ScheduleMode>(1300);
  const dayFeedback = useTransientFeedback<number>(1300);

  const getDayHours = (day: number) =>
    scheduleMode === "uniform"
      ? uniformHours
      : (customHours[day] ?? uniformHours);
  const getDayStartTime = (day: number) =>
    scheduleMode === "uniform"
      ? uniformStartTime
      : (customStartTimes[day] ?? uniformStartTime);
  const weeklyHours = [...selectedDays].reduce(
    (total, day) => total + getDayHours(day),
    0,
  );

  useLayoutEffect(() => {
    if (!hasReportedInitialAvailability.current) {
      hasReportedInitialAvailability.current = true;
      return;
    }

    if (selectedDays.size === 0) {
      onChange(null);
      return;
    }

    const days: DayAvailability[] = [...selectedDays]
      .sort((left, right) => left - right)
      .map((day) => {
        const startTime = parseStartTime(
          scheduleMode === "uniform"
            ? uniformStartTime
            : (customStartTimes[day] ?? uniformStartTime),
        );

        return {
          day_of_week: day,
          hours:
            scheduleMode === "uniform"
              ? uniformHours
              : (customHours[day] ?? uniformHours),
          start_hour: startTime?.hour ?? Number.NaN,
          start_minute: startTime?.minute ?? Number.NaN,
        };
      });
    const isValid = days.every(
      (day) =>
        Number.isFinite(day.hours) &&
        day.hours > 0 &&
        Number.isInteger(day.start_hour) &&
        Number.isInteger(day.start_minute),
    );

    onChange(isValid ? { days } : null);
  }, [
    customHours,
    customStartTimes,
    onChange,
    scheduleMode,
    selectedDays,
    uniformHours,
    uniformStartTime,
  ]);

  const setDays = (days: number[]) => {
    setSelectedDays(new Set(days));
    setValidationError("");
  };

  const toggleDay = (day: number) => {
    const next = new Set(selectedDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    setSelectedDays(next);
    setValidationError("");
    dayFeedback.trigger(day);
  };

  return (
    <section aria-labelledby="availability-heading" class="space-y-4">
      <h3 id="availability-heading" class="sr-only">
        {t.availability.form.heading}
      </h3>

      <div
        class="planner-preset-group"
        aria-label={t.availability.form.presets}
      >
        <p class="section-eyebrow">{t.availability.form.presets}</p>
        <div class="planner-preset-actions">
          {[
            { label: t.availability.form.weeknights, days: [0, 1, 2, 3, 4] },
            { label: t.availability.form.weekends, days: [5, 6] },
            {
              label: t.availability.form.everyDay,
              days: [0, 1, 2, 3, 4, 5, 6],
            },
            { label: t.availability.form.clear, days: [] },
          ].map((preset) => (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              onClick={() => setDays(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <fieldset class="planner-toggle-grid">
        <legend class="sr-only">{t.availability.form.scheduleMode}</legend>
        <label
          class={`planner-option-card ${
            scheduleMode === "uniform" ? "planner-option-card--active" : ""
          } ${scheduleModeFeedback.active === "uniform" ? "planner-choice--confirmed" : ""}`}
        >
          <input
            type="radio"
            name="schedule-mode"
            checked={scheduleMode === "uniform"}
            onChange={() => {
              setScheduleMode("uniform");
              scheduleModeFeedback.trigger("uniform");
            }}
            class="planner-choice-input"
          />
          <div class="planner-option-card__body">
            <div class="planner-choice-row">
              <p class="planner-option-card__label">
                {t.availability.form.sameSchedule}
              </p>
              {scheduleMode === "uniform" && (
                <CheckIcon
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
            <p class="planner-option-card__text">
              {t.availability.form.sameScheduleCopy}
            </p>
          </div>
        </label>

        <label
          class={`planner-option-card ${
            scheduleMode === "custom" ? "planner-option-card--active" : ""
          } ${scheduleModeFeedback.active === "custom" ? "planner-choice--confirmed" : ""}`}
        >
          <input
            type="radio"
            name="schedule-mode"
            checked={scheduleMode === "custom"}
            onChange={() => {
              setScheduleMode("custom");
              scheduleModeFeedback.trigger("custom");
            }}
            class="planner-choice-input"
          />
          <div class="planner-option-card__body">
            <div class="planner-choice-row">
              <p class="planner-option-card__label">
                {t.availability.form.customSchedule}
              </p>
              {scheduleMode === "custom" && (
                <CheckIcon
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
            <p class="planner-option-card__text">
              {t.availability.form.customScheduleCopy}
            </p>
          </div>
        </label>
      </fieldset>

      {scheduleMode === "uniform" ? (
        <div class="planner-availability-controls">
          <fieldset class="planner-duration-fieldset max-w-xs">
            <legend class="ui-label">
              {t.availability.form.durationPerDay}
            </legend>
            <p class="ui-hint">{t.availability.form.durationHint}</p>
            <div class="planner-duration-fields">
              <DurationInputs
                duration={uniformHours}
                hoursId="uniform-hours"
                hoursLabel={t.availability.form.durationHours}
                minutesId="uniform-minutes"
                minutesLabel={t.availability.form.durationMinutes}
                onChange={(duration) => {
                  setUniformHours(duration);
                  setValidationError("");
                }}
              />
            </div>
          </fieldset>
          <Field
            label={t.availability.form.startTime}
            hint={t.availability.form.startTimeHint}
            controlId="uniform-start-time"
            class="max-w-xs"
          >
            <Input
              id="uniform-start-time"
              type="time"
              min="06:00"
              max="23:59"
              step={60}
              value={uniformStartTime}
              aria-invalid={
                validationError === t.availability.form.startTimeError
              }
              onInput={(event) => {
                setUniformStartTime((event.target as HTMLInputElement).value);
                setValidationError("");
              }}
            />
          </Field>
        </div>
      ) : (
        <p class="planner-section-heading__text">
          {t.availability.form.customScheduleHint}
        </p>
      )}

      <div class="space-y-3">
        <div class="planner-section-heading">
          <p class="section-eyebrow">{t.availability.form.weeklyDays}</p>
          <p class="planner-section-heading__text">
            {t.availability.form.daysCopy}
          </p>
        </div>

        <div class="planner-day-grid">
          {t.availability.days.map((name, index) => {
            const selected = selectedDays.has(index);
            const dayId = `availability-day-${index}`;

            return (
              <div
                key={name}
                class={`planner-day-card ${
                  selected ? "planner-day-card--active" : ""
                } ${dayFeedback.active === index ? "planner-choice--confirmed" : ""}`}
              >
                <label class="planner-day-card__header" htmlFor={dayId}>
                  <input
                    id={dayId}
                    type="checkbox"
                    checked={selected}
                    aria-label={name}
                    onChange={() => toggleDay(index)}
                    class="planner-choice-input"
                  />
                  <span class="planner-day-card__copy">
                    <span class="planner-choice-row">
                      <span class="planner-day-card__label">{name}</span>
                      {selected && (
                        <CheckIcon
                          class="planner-icon planner-choice-indicator"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span class="planner-day-card__text">
                      {t.availability.form.hoursAt(
                        formatDuration(getDayHours(index)),
                        getDayStartTime(index),
                      )}
                    </span>
                  </span>
                </label>

                {scheduleMode === "custom" && selected && (
                  <div class="planner-day-card__controls">
                    <div class="planner-duration-fields">
                      <DurationInputs
                        duration={customHours[index] ?? uniformHours}
                        hoursId={`custom-hours-${index}`}
                        hoursLabel={t.availability.form.dayHours(name)}
                        minutesId={`custom-minutes-${index}`}
                        minutesLabel={t.availability.form.dayMinutes(name)}
                        onChange={(duration) => {
                          setCustomHours({
                            ...customHours,
                            [index]: duration,
                          });
                          setValidationError("");
                        }}
                      />
                    </div>
                    <Field
                      label={t.availability.form.dayStartTime(name)}
                      controlId={`custom-start-time-${index}`}
                    >
                      <Input
                        id={`custom-start-time-${index}`}
                        type="time"
                        min="06:00"
                        max="23:59"
                        step={60}
                        value={customStartTimes[index] ?? uniformStartTime}
                        onInput={(event) => {
                          setCustomStartTimes({
                            ...customStartTimes,
                            [index]: (event.target as HTMLInputElement).value,
                          });
                          setValidationError("");
                        }}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <output class="planner-availability-summary" aria-live="polite">
        <span>
          {t.availability.form.weeklyTotal(formatDuration(weeklyHours))}
        </span>
      </output>

      {validationError && (
        <p id="availability-error" role="alert" class="planner-form-error">
          {validationError}
        </p>
      )}
    </section>
  );
}
