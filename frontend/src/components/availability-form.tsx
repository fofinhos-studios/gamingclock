import { Save } from "lucide-preact";
import { useState } from "preact/hooks";

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

interface Props {
  onSubmit: (availability: WeeklyAvailability) => void;
}

export function AvailabilityForm({ onSubmit }: Props) {
  const [mode, setMode] = useState<"uniform" | "custom">("uniform");
  const [uniformHours, setUniformHours] = useState(2);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [customHours, setCustomHours] = useState<Record<number, number>>({});

  const toggleDay = (day: number) => {
    const next = new Set(selectedDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    setSelectedDays(next);
  };

  const handleSubmit = () => {
    const days: DayAvailability[] = [...selectedDays].sort().map((day) => ({
      day_of_week: day,
      hours: mode === "uniform" ? uniformHours : (customHours[day] ?? 1),
    }));
    onSubmit({ days });
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
            mode === "uniform" ? "planner-option-card--active" : ""
          }`}
        >
          <input
            type="radio"
            checked={mode === "uniform"}
            onChange={() => setMode("uniform")}
          />
          <div class="planner-option-card__body">
            <p class="planner-option-card__label">Uniform</p>
            <p class="planner-option-card__text">
              Same hours on every selected day
            </p>
          </div>
        </label>

        <label
          class={`planner-option-card ${
            mode === "custom" ? "planner-option-card--active" : ""
          }`}
        >
          <input
            type="radio"
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
          />
          <div class="planner-option-card__body">
            <p class="planner-option-card__label">Custom</p>
            <p class="planner-option-card__text">Different hours by day</p>
          </div>
        </label>
      </fieldset>

      {mode === "uniform" && (
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
        <p class="section-eyebrow">Weekly days</p>
        <div class="planner-day-grid">
          {DAY_NAMES.map((name, index) => {
            const selected = selectedDays.has(index);

            return (
              <label
                key={name}
                class={`planner-day-card ${
                  selected ? "planner-day-card--active" : ""
                }`}
              >
                <div class="planner-day-card__header">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleDay(index)}
                  />
                  <div class="planner-day-card__copy">
                    <p class="planner-day-card__label">{name}</p>
                    <p class="planner-day-card__text">
                      {mode === "uniform"
                        ? `${uniformHours} hour${uniformHours === 1 ? "" : "s"}`
                        : "Custom hours"}
                    </p>
                  </div>
                </div>

                {mode === "custom" && selected && (
                  <Input
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
        >
          <Save class="planner-icon" aria-hidden="true" />
          Save Availability
        </Button>
      </div>
    </section>
  );
}
