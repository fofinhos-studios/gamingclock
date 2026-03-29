import type {
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";
import { ScheduleView } from "./schedule-view";
import { Button, Card, Field, Input, Select } from "./ui";

interface Props {
  availability: WeeklyAvailability | null;
  algorithm: ScheduleAlgorithm;
  startDate: string;
  schedule: ScheduleResponse | null;
  actionError: string;
  canGenerateSchedule: boolean;
  prerequisiteMessages: string[];
  onAlgorithmChange: (algorithm: ScheduleAlgorithm) => void;
  onStartDateChange: (startDate: string) => void;
  onGenerateSchedule: () => void;
  onDownloadIcal: () => void;
}

export function PlannerScheduleStep({
  availability,
  algorithm,
  startDate,
  schedule,
  actionError,
  canGenerateSchedule,
  prerequisiteMessages,
  onAlgorithmChange,
  onStartDateChange,
  onGenerateSchedule,
  onDownloadIcal,
}: Props) {
  return (
    <section aria-labelledby="planner-schedule-heading" class="space-y-6">
      <div class="space-y-3">
        <p class="section-eyebrow">Schedule</p>
        <h2 id="planner-schedule-heading" class="text-4xl md:text-5xl">
          Generate schedule
        </h2>
        <p class="section-copy max-w-none">
          Choose a start date and algorithm for your current backlog.
        </p>
      </div>

      <Card
        tone={availability ? "inverted" : "default"}
        class={`flex flex-col gap-6 p-6 md:p-8 ${
          availability ? "texture-vertical" : ""
        }`}
      >
        {prerequisiteMessages.length > 0 && (
          <div
            class={`space-y-2 border-2 p-4 ${
              availability
                ? "border-white/70 bg-black/20 text-white"
                : "border-black/20 bg-black/5"
            }`}
          >
            <p
              class={`font-[var(--font-mono)] text-xs uppercase tracking-[0.24em] ${
                availability
                  ? "text-white/70"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              Schedule prerequisites
            </p>
            <ul class="space-y-2 text-sm">
              {prerequisiteMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Start date" controlId="schedule-start-date">
          <Input
            id="schedule-start-date"
            type="date"
            value={startDate}
            onInput={(event) =>
              onStartDateChange((event.target as HTMLInputElement).value)
            }
            class={availability ? "bg-white text-black" : ""}
          />
        </Field>

        <Field label="Algorithm" controlId="schedule-algorithm">
          <Select
            id="schedule-algorithm"
            value={algorithm}
            onChange={(event) =>
              onAlgorithmChange(
                (event.target as HTMLSelectElement).value as ScheduleAlgorithm,
              )
            }
            class={availability ? "bg-white text-black" : ""}
          >
            <option value="sequential">Sequential</option>
            <option value="alternating">Alternating</option>
          </Select>
        </Field>

        {actionError && (
          <p role="alert" class={availability ? "text-white" : "text-black"}>
            {actionError}
          </p>
        )}

        <Button
          type="button"
          onClick={onGenerateSchedule}
          disabled={!canGenerateSchedule}
          variant={availability ? "outline" : "primary"}
          class={
            availability
              ? "border-white bg-white text-black hover:border-white hover:bg-black hover:text-white"
              : undefined
          }
        >
          Generate Schedule
        </Button>
      </Card>

      {schedule && (
        <Card class="p-6 md:p-8">
          <ScheduleView schedule={schedule} onDownloadIcal={onDownloadIcal} />
        </Card>
      )}
    </section>
  );
}
