import {
  CalendarDays,
  CalendarRange,
  Clock3,
  Flag,
  FolderOpen,
  Hourglass,
  List,
  Route,
  Rows3,
} from "lucide-preact";

interface Props {
  backlogName: string;
  trackedGameCount: number;
  resolvedHours: number;
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
        <SummaryItem label="Backlog" value={backlogName} icon={FolderOpen} />
        <SummaryItem
          label="Games"
          value={String(trackedGameCount)}
          icon={List}
        />
        <SummaryItem
          label="Resolved hours"
          value={`${resolvedHours.toFixed(1)}h`}
          icon={Clock3}
        />
        <SummaryItem
          label="Availability status"
          value={availabilityStatus}
          detail={availabilityDetail}
          icon={CalendarDays}
        />
        <SummaryItem
          label="Schedule status"
          value={scheduleStatus}
          detail={scheduleDetail}
          icon={Route}
        />
        {typeof totalPlannedHours === "number" && (
          <SummaryItem
            label="Planned hours"
            value={`${totalPlannedHours.toFixed(1)}h`}
            icon={Hourglass}
          />
        )}
        {typeof totalSessions === "number" && (
          <SummaryItem
            label="Sessions"
            value={String(totalSessions)}
            icon={Rows3}
          />
        )}
        {estimatedFinishDate && (
          <SummaryItem
            label="Finish date"
            value={estimatedFinishDate}
            icon={Flag}
          />
        )}
        {typeof totalElapsedDays === "number" && (
          <SummaryItem
            label="Elapsed days"
            value={`${totalElapsedDays} day${totalElapsedDays === 1 ? "" : "s"}`}
            icon={CalendarRange}
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
  icon: typeof FolderOpen;
}

function SummaryItem({ label, value, detail, icon: Icon }: SummaryItemProps) {
  return (
    <div class="planner-statusbar__item">
      <dt class="planner-statusbar__label">
        <Icon class="planner-icon planner-statusbar__icon" aria-hidden="true" />
        <span>{label}</span>
      </dt>
      <dd class="planner-statusbar__value">{value}</dd>
      {detail && <p class="planner-statusbar__detail">{detail}</p>}
    </div>
  );
}
