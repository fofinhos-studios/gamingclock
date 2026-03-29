import type { ScheduleResponse } from "../types";
import { Button } from "./ui";

interface Props {
  schedule: ScheduleResponse;
  onDownloadIcal: () => void;
}

function calculateElapsedDays(schedule: ScheduleResponse): number | null {
  const firstSessionDate = schedule.sessions[0]?.date;
  const lastDate = schedule.sessions.at(-1)?.date;

  if (!firstSessionDate || !lastDate) {
    return null;
  }

  const start = new Date(`${firstSessionDate}T00:00:00Z`);
  const end = new Date(`${lastDate}T00:00:00Z`);
  const differenceInDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return differenceInDays >= 0 ? differenceInDays + 1 : null;
}

export function ScheduleView({ schedule, onDownloadIcal }: Props) {
  if (schedule.sessions.length === 0) {
    return (
      <section>
        <p>No sessions generated.</p>
      </section>
    );
  }

  const totalElapsedDays = calculateElapsedDays(schedule);

  return (
    <section aria-labelledby="schedule-heading" class="space-y-4">
      <div class="planner-pane__header">
        <div class="space-y-1">
          <p class="section-eyebrow">Output</p>
          <h2 id="schedule-heading" class="planner-panel__title">
            Generated schedule
          </h2>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onDownloadIcal}
        >
          Download .ics
        </Button>
      </div>

      <div class="planner-metric-grid">
        <div class="planner-metric">
          <p class="planner-metric__label">Total planned hours</p>
          <p class="planner-metric__value">{schedule.total_hours.toFixed(1)}</p>
        </div>
        <div class="planner-metric">
          <p class="planner-metric__label">Estimated finish</p>
          <p class="planner-metric__value">
            {schedule.estimated_end_date ?? "Not available"}
          </p>
        </div>
        <div class="planner-metric">
          <p class="planner-metric__label">Sessions</p>
          <p class="planner-metric__value">{schedule.sessions.length}</p>
        </div>
        {totalElapsedDays !== null && (
          <div class="planner-metric">
            <p class="planner-metric__label">Total elapsed days</p>
            <p class="planner-metric__value">
              {totalElapsedDays} day{totalElapsedDays === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      <div class="space-y-3">
        <p class="section-eyebrow">Session timeline</p>
        <ol class="timeline">
          {schedule.sessions.map((session, index) => (
            <li key={`${session.game_name}-${session.date}-${index}`}>
              <article class="timeline-entry">
                <div class="timeline-entry__header">
                  <p class="timeline-meta">
                    {session.date} / starts {session.start_time}
                  </p>
                  <p class="timeline-duration">
                    {session.duration_hours.toFixed(1)}h
                  </p>
                </div>
                <h3 class="timeline-title">{session.game_name}</h3>
                <p class="timeline-detail">
                  {session.duration_hours.toFixed(1)} planned hours
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
