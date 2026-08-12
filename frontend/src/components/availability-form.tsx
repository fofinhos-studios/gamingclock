import { Check, Clock3, Save } from "lucide-preact";
import { useState } from "preact/hooks";

import { useTransientFeedback } from "../hooks/use-transient-feedback";
import type { DayAvailability, WeeklyAvailability } from "../types";
import { Button, Field, Input } from "./ui";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const START_HOURS = Array.from({ length: 18 }, (_, index) => index + 6);

interface Props {
  availability: WeeklyAvailability | null;
  onSubmit: (availability: WeeklyAvailability) => void;
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function AvailabilityForm({ availability, onSubmit }: Props) {
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
  const startHourFeedback = useTransientFeedback<string>(1300);
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
        Availability
      </h3>

      <fieldset class="planner-toggle-grid">
        <legend class="sr-only">Availability mode</legend>
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
              <p class="planner-option-card__label">Uniform</p>
              {hoursMode === "uniform" && (
                <Check
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
            <p class="planner-option-card__text">
              Same hours on every selected day
            </p>
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
              <p class="planner-option-card__label">Custom</p>
              {hoursMode === "custom" && (
                <Check
                  class="planner-icon planner-choice-indicator"
                  aria-hidden="true"
                />
              )}
            </div>
            <p class="planner-option-card__text">Different hours by day</p>
          </div>
        </label>
      </fieldset>

      {hoursMode === "uniform" && (
        <Field
          label="Hours per selected day"
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

      <div class="space-y-3">
        <div class="planner-section-heading">
          <p class="section-eyebrow">Start hour</p>
          <p class="planner-section-heading__text">
            Use one start hour across the week, or set it per day.
          </p>
        </div>

        <fieldset class="planner-toggle-grid">
          <legend class="sr-only">Start hour mode</legend>
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
                <p class="planner-option-card__label">Uniform</p>
                {startHourMode === "uniform" && (
                  <Check
                    class="planner-icon planner-choice-indicator"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p class="planner-option-card__text">
                Same start hour on every selected day
              </p>
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
                <p class="planner-option-card__label">Custom</p>
                {startHourMode === "custom" && (
                  <Check
                    class="planner-icon planner-choice-indicator"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p class="planner-option-card__text">
                Different start hour by day
              </p>
            </div>
          </label>
        </fieldset>

        {startHourMode === "uniform" && (
          <fieldset class="planner-hour-fieldset">
            <legend class="sr-only">Uniform start hour</legend>
            <div class="planner-hour-grid">
              {START_HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  class={`planner-hour-chip ${
                    uniformStartHour === hour ? "planner-hour-chip--active" : ""
                  } ${
                    startHourFeedback.active === `uniform-${hour}`
                      ? "planner-choice--confirmed"
                      : ""
                  }`}
                  aria-pressed={uniformStartHour === hour}
                  onClick={() => {
                    setUniformStartHour(hour);
                    startHourFeedback.trigger(`uniform-${hour}`);
                  }}
                >
                  <span class="planner-hour-chip__label">
                    {formatHour(hour)}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div class="space-y-3">
        <p class="section-eyebrow">Weekly days</p>
        <div class="planner-day-grid">
          {DAY_NAMES.map((name, index) => {
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
                        <Check
                          class="planner-icon planner-choice-indicator"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p class="planner-day-card__text">
                      {`${getDayHours(index)} hour${
                        getDayHours(index) === 1 ? "" : "s"
                      } / ${formatHour(getDayStartHour(index))}`}
                    </p>
                  </div>
                </div>

                {(hoursMode === "custom" || startHourMode === "custom") &&
                  selected && (
                    <div class="planner-day-card__controls">
                      {hoursMode === "custom" && (
                        <Field
                          label={`${name} hours`}
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
                        <fieldset class="planner-hour-fieldset">
                          <legend class="planner-subtle-label">
                            <Clock3 class="planner-icon" aria-hidden="true" />
                            <span>{name} start hour</span>
                          </legend>
                          <div class="planner-hour-grid planner-hour-grid--compact">
                            {START_HOURS.map((hour) => (
                              <button
                                key={hour}
                                type="button"
                                class={`planner-hour-chip ${
                                  getDayStartHour(index) === hour
                                    ? "planner-hour-chip--active"
                                    : ""
                                } ${
                                  startHourFeedback.active ===
                                  `${index}-${hour}`
                                    ? "planner-choice--confirmed"
                                    : ""
                                }`}
                                aria-pressed={getDayStartHour(index) === hour}
                                onClick={() => {
                                  setCustomStartHours({
                                    ...customStartHours,
                                    [index]: hour,
                                  });
                                  startHourFeedback.trigger(`${index}-${hour}`);
                                }}
                              >
                                <span class="planner-hour-chip__label">
                                  {formatHour(hour)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </fieldset>
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
            <Check class="planner-icon" aria-hidden="true" />
          ) : (
            <Save class="planner-icon" aria-hidden="true" />
          )}
          {submitFeedback.active === "saved" ? "Saved" : "Save Availability"}
        </Button>
      </div>
    </section>
  );
}
