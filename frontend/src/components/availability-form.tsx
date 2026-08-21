import { CheckIcon } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import type { DayAvailability, WeeklyAvailability } from "../types";
import { Button, Field, Input } from "./ui";

const MIN_HOURS = 0.5;
const MAX_HOURS = 16;
const MIN_START_HOUR = 6;
const MAX_START_HOUR = 23;
type ScheduleMode = "uniform" | "custom";

interface Props {
  availability: WeeklyAvailability | null;
  onChange: (availability: WeeklyAvailability | null) => void;
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function parseStartHour(value: string): number | null {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute !== 0 ||
    hour < MIN_START_HOUR ||
    hour > MAX_START_HOUR
  ) {
    return null;
  }

  return hour;
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function AvailabilityForm({ availability, onChange }: Props) {
  const { t } = useLanguage();
  const initialDays = availability?.days ?? [];
  const initialHours = initialDays[0]?.hours ?? 2;
  const initialStartTime = formatHour(initialDays[0]?.start_hour ?? 20);
  const initialScheduleIsUniform = initialDays.every(
    (day) =>
      day.hours === initialHours &&
      formatHour(day.start_hour) === initialStartTime,
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
      initialDays.map((day) => [day.day_of_week, formatHour(day.start_hour)]),
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
      .map((day) => ({
        day_of_week: day,
        hours:
          scheduleMode === "uniform"
            ? uniformHours
            : (customHours[day] ?? uniformHours),
        start_hour:
          parseStartHour(
            scheduleMode === "uniform"
              ? uniformStartTime
              : (customStartTimes[day] ?? uniformStartTime),
          ) ?? Number.NaN,
      }));
    const isValid = days.every(
      (day) =>
        Number.isFinite(day.hours) &&
        day.hours >= MIN_HOURS &&
        day.hours <= MAX_HOURS &&
        Number.isInteger(day.start_hour),
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
          <Field
            label={t.availability.form.hoursPerDay}
            hint={t.availability.form.hoursHint}
            controlId="uniform-hours"
            class="max-w-xs"
          >
            <Input
              id="uniform-hours"
              type="number"
              min={MIN_HOURS}
              max={MAX_HOURS}
              step={0.5}
              value={uniformHours}
              aria-invalid={validationError === t.availability.form.hoursError}
              onInput={(event) => {
                setUniformHours(
                  Number((event.target as HTMLInputElement).value),
                );
                setValidationError("");
              }}
            />
          </Field>
          <Field
            label={t.availability.form.startTime}
            hint={t.availability.form.startTimeHint}
            controlId="uniform-start-time"
            class="max-w-xs"
          >
            <Input
              id="uniform-start-time"
              type="time"
              min={formatHour(MIN_START_HOUR)}
              max={formatHour(MAX_START_HOUR)}
              step={3600}
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
                        getDayHours(index),
                        getDayStartTime(index),
                      )}
                    </span>
                  </span>
                </label>

                {scheduleMode === "custom" && selected && (
                  <div class="planner-day-card__controls">
                    <Field
                      label={t.availability.form.dayHours(name)}
                      hint={t.availability.form.hoursHint}
                      controlId={`custom-hours-${index}`}
                    >
                      <Input
                        id={`custom-hours-${index}`}
                        type="number"
                        min={MIN_HOURS}
                        max={MAX_HOURS}
                        step={0.5}
                        value={customHours[index] ?? uniformHours}
                        onInput={(event) => {
                          setCustomHours({
                            ...customHours,
                            [index]: Number(
                              (event.target as HTMLInputElement).value,
                            ),
                          });
                          setValidationError("");
                        }}
                      />
                    </Field>
                    <Field
                      label={t.availability.form.dayStartTime(name)}
                      controlId={`custom-start-time-${index}`}
                    >
                      <Input
                        id={`custom-start-time-${index}`}
                        type="time"
                        min={formatHour(MIN_START_HOUR)}
                        max={formatHour(MAX_START_HOUR)}
                        step={3600}
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
        <span>{t.availability.form.weeklyTotal(formatHours(weeklyHours))}</span>
      </output>

      {validationError && (
        <p id="availability-error" role="alert" class="planner-form-error">
          {validationError}
        </p>
      )}
    </section>
  );
}
