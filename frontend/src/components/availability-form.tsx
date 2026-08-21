import { CheckIcon, FloppyDiskIcon } from "@phosphor-icons/react";
import { useState } from "preact/hooks";

import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import type { DayAvailability, WeeklyAvailability } from "../types";
import { Button, Field, Input } from "./ui";

interface Props {
  availability: WeeklyAvailability | null;
  onSubmit: (availability: WeeklyAvailability) => void;
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function parseHour(value: string): number {
  return Number(value.slice(0, 2));
}

export function AvailabilityForm({ availability, onSubmit }: Props) {
  const { t } = useLanguage();
  const initialDays = availability?.days ?? [];
  const initialHours = initialDays[0]?.hours ?? 2;
  const initialStartHour = initialDays[0]?.start_hour ?? 20;
  const initialHoursAreUniform = initialDays.every(
    (day) => day.hours === initialHours,
  );
  const initialStartHoursAreUniform = initialDays.every(
    (day) => day.start_hour === initialStartHour,
  );
  const [hoursMode, setHoursMode] = useState<"uniform" | "custom">(
    initialHoursAreUniform ? "uniform" : "custom",
  );
  const [startHourMode, setStartHourMode] = useState<"uniform" | "custom">(
    initialStartHoursAreUniform ? "uniform" : "custom",
  );
  const [uniformHours, setUniformHours] = useState(initialHours);
  const [uniformStartHour, setUniformStartHour] = useState(initialStartHour);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    new Set(initialDays.map((day) => day.day_of_week)),
  );
  const [customHours, setCustomHours] = useState<Record<number, number>>(
    Object.fromEntries(initialDays.map((day) => [day.day_of_week, day.hours])),
  );
  const [customStartHours, setCustomStartHours] = useState<
    Record<number, number>
  >(
    Object.fromEntries(
      initialDays.map((day) => [day.day_of_week, day.start_hour]),
    ),
  );
  const hoursModeFeedback = useTransientFeedback<"uniform" | "custom">(1300);
  const startHourModeFeedback = useTransientFeedback<"uniform" | "custom">(
    1300,
  );
  const dayFeedback = useTransientFeedback<number>(1300);
  const submitFeedback = useTransientFeedback<"saved">(1800);

  const getDayHours = (day: number) =>
    hoursMode === "uniform" ? uniformHours : (customHours[day] ?? 1);
  const getDayStartHour = (day: number) =>
    startHourMode === "uniform"
      ? uniformStartHour
      : (customStartHours[day] ?? uniformStartHour);

  const toggleDay = (day: number) => {
    const next = new Set(selectedDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    setSelectedDays(next);
    dayFeedback.trigger(day);
  };

  const handleSubmit = () => {
    const days: DayAvailability[] = [...selectedDays].sort().map((day) => ({
      day_of_week: day,
      hours: getDayHours(day),
      start_hour: getDayStartHour(day),
    }));
    onSubmit({ days });
    submitFeedback.trigger("saved");
  };

  return (
    <section aria-labelledby="availability-heading" class="space-y-4">
      <h3 id="availability-heading" class="sr-only">
        {t.availability.form.heading}
      </h3>

      <fieldset class="planner-toggle-grid">
        <legend class="sr-only">{t.availability.form.mode}</legend>
        <label
          class={`planner-option-card ${
            hoursMode === "uniform" ? "planner-option-card--active" : ""
          } ${hoursModeFeedback.active === "uniform" ? "planner-choice--confirmed" : ""}`}
        >
          <input
            type="radio"
            checked={hoursMode === "uniform"}
            onChange={() => {
              setHoursMode("uniform");
              hoursModeFeedback.trigger("uniform");
            }}
            class="planner-choice-input"
          />
          <div class="planner-option-card__body">
            <div class="planner-choice-row">
              <p class="planner-option-card__label">
                {t.availability.form.uniform}
              </p>
              {hoursMode === "uniform" && (
                <CheckIcon
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </label>

        <label
          class={`planner-option-card ${
            hoursMode === "custom" ? "planner-option-card--active" : ""
          } ${hoursModeFeedback.active === "custom" ? "planner-choice--confirmed" : ""}`}
        >
          <input
            type="radio"
            checked={hoursMode === "custom"}
            onChange={() => {
              setHoursMode("custom");
              hoursModeFeedback.trigger("custom");
            }}
            class="planner-choice-input"
          />
          <div class="planner-option-card__body">
            <div class="planner-choice-row">
              <p class="planner-option-card__label">
                {t.availability.form.custom}
              </p>
              {hoursMode === "custom" && (
                <CheckIcon
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </label>
      </fieldset>

      {hoursMode === "uniform" && (
        <Field
          label={t.availability.form.hoursPerDay}
          controlId="uniform-hours"
          class="max-w-xs"
        >
          <Input
            id="uniform-hours"
            type="number"
            min={0.5}
            max={16}
            step={0.5}
            value={uniformHours}
            onInput={(event) =>
              setUniformHours(Number((event.target as HTMLInputElement).value))
            }
          />
        </Field>
      )}

      <fieldset class="planner-toggle-grid">
        <legend class="sr-only">{t.availability.form.startHourMode}</legend>
        <label
          class={`planner-option-card ${
            startHourMode === "uniform" ? "planner-option-card--active" : ""
          } ${startHourModeFeedback.active === "uniform" ? "planner-choice--confirmed" : ""}`}
        >
          <input
            type="radio"
            checked={startHourMode === "uniform"}
            onChange={() => {
              setStartHourMode("uniform");
              startHourModeFeedback.trigger("uniform");
            }}
            class="planner-choice-input"
          />
          <div class="planner-option-card__body">
            <div class="planner-choice-row">
              <p class="planner-option-card__label">
                {t.availability.form.uniform}
              </p>
              {startHourMode === "uniform" && (
                <CheckIcon
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </label>

        <label
          class={`planner-option-card ${
            startHourMode === "custom" ? "planner-option-card--active" : ""
          } ${startHourModeFeedback.active === "custom" ? "planner-choice--confirmed" : ""}`}
        >
          <input
            type="radio"
            checked={startHourMode === "custom"}
            onChange={() => {
              setStartHourMode("custom");
              startHourModeFeedback.trigger("custom");
            }}
            class="planner-choice-input"
          />
          <div class="planner-option-card__body">
            <div class="planner-choice-row">
              <p class="planner-option-card__label">
                {t.availability.form.custom}
              </p>
              {startHourMode === "custom" && (
                <CheckIcon
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </label>
      </fieldset>

      {startHourMode === "uniform" && (
        <Field
          label={t.availability.form.startHour}
          controlId="uniform-start-hour"
          class="max-w-xs"
        >
          <Input
            id="uniform-start-hour"
            type="time"
            min="06:00"
            max="23:00"
            step="3600"
            value={formatHour(uniformStartHour)}
            onInput={(event) =>
              setUniformStartHour(
                parseHour((event.target as HTMLInputElement).value),
              )
            }
          />
        </Field>
      )}

      <div class="space-y-3">
        <p class="section-eyebrow">{t.availability.form.weeklyDays}</p>
        <div class="planner-day-grid">
          {t.availability.days.map((name, index) => {
            const selected = selectedDays.has(index);

            return (
              <label
                key={name}
                class={`planner-day-card ${
                  selected ? "planner-day-card--active" : ""
                } ${dayFeedback.active === index ? "planner-choice--confirmed" : ""}`}
              >
                <div class="planner-day-card__header">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleDay(index)}
                    class="planner-choice-input"
                  />
                  <div class="planner-day-card__copy">
                    <div class="planner-choice-row">
                      <p class="planner-day-card__label">{name}</p>
                      {selected && (
                        <CheckIcon
                          class="planner-icon planner-choice-indicator"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p class="planner-day-card__text">
                      {t.availability.form.hoursAt(
                        getDayHours(index),
                        formatHour(getDayStartHour(index)),
                      )}
                    </p>
                  </div>
                </div>

                {(hoursMode === "custom" || startHourMode === "custom") &&
                  selected && (
                    <div class="planner-day-card__controls">
                      {hoursMode === "custom" && (
                        <Field
                          label={t.availability.form.dayHours(name)}
                          controlId={`custom-hours-${index}`}
                        >
                          <Input
                            id={`custom-hours-${index}`}
                            type="number"
                            min={0.5}
                            max={16}
                            step={0.5}
                            value={customHours[index] ?? 1}
                            onInput={(event) =>
                              setCustomHours({
                                ...customHours,
                                [index]: Number(
                                  (event.target as HTMLInputElement).value,
                                ),
                              })
                            }
                          />
                        </Field>
                      )}

                      {startHourMode === "custom" && (
                        <Field
                          label={t.availability.form.dayStart(name)}
                          controlId={`custom-start-${index}`}
                        >
                          <Input
                            id={`custom-start-${index}`}
                            type="time"
                            min="06:00"
                            max="23:00"
                            step="3600"
                            value={formatHour(getDayStartHour(index))}
                            onInput={(event) =>
                              setCustomStartHours({
                                ...customStartHours,
                                [index]: parseHour(
                                  (event.target as HTMLInputElement).value,
                                ),
                              })
                            }
                          />
                        </Field>
                      )}
                    </div>
                  )}
              </label>
            );
          })}
        </div>
      </div>

      <div class="planner-form-actions">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={selectedDays.size === 0}
          variant="primary"
          size="sm"
          feedbackState={submitFeedback.active === "saved" ? "success" : "idle"}
        >
          {submitFeedback.active === "saved" ? (
            <CheckIcon class="planner-icon" aria-hidden="true" />
          ) : (
            <FloppyDiskIcon class="planner-icon" aria-hidden="true" />
          )}
          {submitFeedback.active === "saved"
            ? t.availability.form.saved
            : t.availability.form.save}
        </Button>
      </div>
    </section>
  );
}
