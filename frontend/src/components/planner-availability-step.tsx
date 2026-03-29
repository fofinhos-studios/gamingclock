import type { WeeklyAvailability } from "../types";
import { AvailabilityForm } from "./availability-form";
import { Card } from "./ui";

interface Props {
  availability: WeeklyAvailability | null;
  gameCount: number;
  onSubmit: (availability: WeeklyAvailability) => void;
}

export function PlannerAvailabilityStep({
  availability,
  gameCount,
  onSubmit,
}: Props) {
  return (
    <div class="space-y-6">
      <Card class="p-6 md:p-8">
        <AvailabilityForm onSubmit={onSubmit} />
      </Card>

      <Card tone={availability ? "inverted" : "muted"} class="p-6">
        <p class={`section-eyebrow ${availability ? "text-white/70" : ""}`}>
          Planner note
        </p>
        <p class={`mt-3 text-xl ${availability ? "text-white" : ""}`}>
          {gameCount === 0
            ? "You can set weekly time now and add games later before generating a schedule."
            : "Update your weekly time whenever your routine changes. Existing schedules will be cleared when availability changes."}
        </p>
      </Card>
    </div>
  );
}
