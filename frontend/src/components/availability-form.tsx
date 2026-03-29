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
    <section aria-labelledby="availability-heading" class="space-y-6">
      <div class="space-y-3">
        <p class="section-eyebrow">Availability</p>
        <h3 id="availability-heading" class="text-4xl md:text-5xl">
          Weekly cadence
        </h3>
        <p class="section-copy max-w-none">
          This is an estimate to help plan your gaming time. Actual play times
          may vary.
        </p>
      </div>

      <fieldset class="grid gap-4 md:grid-cols-2">
        <legend class="sr-only">Availability mode</legend>
        <label
          class={`cursor-pointer border border-black p-5 transition-colors duration-100 ${
            mode === "uniform" ? "bg-black text-white" : "bg-white text-black"
          }`}
        >
          <div class="flex items-start gap-3">
            <input
              type="radio"
              checked={mode === "uniform"}
              onChange={() => setMode("uniform")}
              class="mt-1"
            />
            <div class="space-y-1">
              <p class="section-eyebrow">Uniform</p>
              <p class="text-2xl leading-none">Same hours every selected day</p>
            </div>
          </div>
        </label>

        <label
          class={`cursor-pointer border border-black p-5 transition-colors duration-100 ${
            mode === "custom" ? "bg-black text-white" : "bg-white text-black"
          }`}
        >
          <div class="flex items-start gap-3">
            <input
              type="radio"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
              class="mt-1"
            />
            <div class="space-y-1">
              <p class="section-eyebrow">Custom</p>
              <p class="text-2xl leading-none">Different hours per day</p>
            </div>
          </div>
        </label>
      </fieldset>

      {mode === "uniform" && (
        <Field label="Hours per selected day" controlId="uniform-hours">
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
            class="md:max-w-xs"
          />
        </Field>
      )}

      <div class="space-y-4">
        <p class="section-eyebrow">Days</p>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAY_NAMES.map((name, index) => {
            const selected = selectedDays.has(index);

            return (
              <label
                key={name}
                class={`border border-black p-4 transition-colors duration-100 ${
                  selected ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleDay(index)}
                  />
                  <div>
                    <p class="section-eyebrow">Day</p>
                    <p class="text-2xl leading-none">{name}</p>
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
                    class="mt-4 bg-white text-black"
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={selectedDays.size === 0}
        variant="primary"
      >
        Set Availability
      </Button>
    </section>
  );
}
