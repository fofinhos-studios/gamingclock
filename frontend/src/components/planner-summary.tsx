import { Card, Stat } from "./ui";

interface Props {
  backlogName: string;
  trackedGameCount: number;
  resolvedHours: number;
  unresolvedGameCount: number;
  availabilityStatus: string;
  availabilityDetail: string;
  scheduleStatus: string;
  scheduleDetail: string;
  totalPlannedHours?: number;
  totalSessions?: number;
  estimatedFinishDate?: string | null;
  totalElapsedDays?: number | null;
}

export function PlannerSummary({
  backlogName,
  trackedGameCount,
  resolvedHours,
  unresolvedGameCount,
  availabilityStatus,
  availabilityDetail,
  scheduleStatus,
  scheduleDetail,
  totalPlannedHours,
  totalSessions,
  estimatedFinishDate,
  totalElapsedDays,
}: Props) {
  return (
    <aside aria-labelledby="planner-summary-heading" class="min-w-0 self-start">
      <Card tone="muted" class="space-y-6 p-6">
        <div class="space-y-3">
          <p class="section-eyebrow">Summary</p>
          <h2 id="planner-summary-heading" class="text-3xl leading-none">
            Planner status
          </h2>
          <p class="text-sm text-[var(--muted-foreground)]">
            Keep track of backlog readiness while you move between steps.
          </p>
        </div>

        <dl class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Stat label="Backlog name" value={backlogName} />
          <Stat label="Tracked games" value={String(trackedGameCount)} />
          <Stat
            label="Resolved hours"
            value={`${resolvedHours.toFixed(1)} hrs`}
          />
          <Stat label="Unresolved games" value={String(unresolvedGameCount)} />
          <Stat
            label="Availability status"
            value={availabilityStatus}
            detail={availabilityDetail}
          />
          <Stat
            label="Schedule status"
            value={scheduleStatus}
            detail={scheduleDetail}
          />
        </dl>

        {typeof totalPlannedHours === "number" && (
          <dl class="grid gap-3 border-t-2 border-black pt-6 sm:grid-cols-2 xl:grid-cols-1">
            <Stat
              label="Total planned hours"
              value={`${totalPlannedHours.toFixed(1)} hrs`}
            />
            <Stat label="Total sessions" value={String(totalSessions ?? 0)} />
            <Stat
              label="Estimated finish"
              value={estimatedFinishDate ?? "Not available"}
            />
            {typeof totalElapsedDays === "number" && (
              <Stat
                label="Total elapsed days"
                value={`${totalElapsedDays} day${totalElapsedDays === 1 ? "" : "s"}`}
              />
            )}
          </dl>
        )}
      </Card>
    </aside>
  );
}
