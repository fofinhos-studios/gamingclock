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
    <aside aria-labelledby="planner-summary-heading" class="planner-statusbar">
      <h2 id="planner-summary-heading" class="sr-only">
        Planner status
      </h2>

      <dl class="planner-statusbar__grid">
        <SummaryItem label="Backlog" value={backlogName} />
        <SummaryItem label="Games" value={String(trackedGameCount)} />
        <SummaryItem
          label="Resolved hours"
          value={`${resolvedHours.toFixed(1)}h`}
        />
        <SummaryItem
          label="Need HLTB match"
          value={String(unresolvedGameCount)}
        />
        <SummaryItem
          label="Availability status"
          value={availabilityStatus}
          detail={availabilityDetail}
        />
        <SummaryItem
          label="Schedule status"
          value={scheduleStatus}
          detail={scheduleDetail}
        />
        {typeof totalPlannedHours === "number" && (
          <SummaryItem
            label="Planned hours"
            value={`${totalPlannedHours.toFixed(1)}h`}
          />
        )}
        {typeof totalSessions === "number" && (
          <SummaryItem label="Sessions" value={String(totalSessions)} />
        )}
        {estimatedFinishDate && (
          <SummaryItem label="Finish date" value={estimatedFinishDate} />
        )}
        {typeof totalElapsedDays === "number" && (
          <SummaryItem
            label="Elapsed days"
            value={`${totalElapsedDays} day${totalElapsedDays === 1 ? "" : "s"}`}
          />
        )}
      </dl>
    </aside>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  detail?: string;
}

function SummaryItem({ label, value, detail }: SummaryItemProps) {
  return (
    <div class="planner-statusbar__item">
      <dt class="planner-statusbar__label">{label}</dt>
      <dd class="planner-statusbar__value">{value}</dd>
      {detail && <p class="planner-statusbar__detail">{detail}</p>}
    </div>
  );
}
