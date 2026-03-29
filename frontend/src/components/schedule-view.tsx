import type { ScheduleResponse } from "../types";
import { Button, Card } from "./ui";

interface Props {
  schedule: ScheduleResponse;
  onDownloadIcal: () => void;
}

export function ScheduleView({ schedule, onDownloadIcal }: Props) {
  if (schedule.sessions.length === 0) {
    return (
      <section>
        <p>No sessions generated.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="schedule-heading" class="space-y-10">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-3">
          <p class="section-eyebrow">Output</p>
          <h2 id="schedule-heading" class="text-5xl md:text-6xl">
            Your Gaming Schedule
          </h2>
          <p class="section-copy max-w-none">Session timeline</p>
        </div>

        <Button type="button" variant="primary" onClick={onDownloadIcal}>
          Download .ics
        </Button>
      </div>

      <div class="grid gap-8 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card
          tone="inverted"
          class="texture-vertical flex flex-col gap-6 self-start"
        >
          <div class="space-y-2">
            <p class="section-eyebrow text-white/70">Summary</p>
            <p class="text-5xl leading-none">
              {schedule.total_hours.toFixed(1)}
            </p>
            <p class="timeline-detail text-white/80">Total planned hours</p>
          </div>

          <div class="border-t-2 border-white pt-4">
            <p class="section-eyebrow text-white/70">Estimated finish</p>
            <p class="mt-3 text-3xl leading-none">
              {schedule.estimated_end_date ?? "Not available"}
            </p>
          </div>

          <div class="border-t-2 border-white pt-4">
            <p class="section-eyebrow text-white/70">Sessions</p>
            <p class="mt-3 text-3xl leading-none">{schedule.sessions.length}</p>
          </div>
        </Card>

        <div class="space-y-5">
          <p class="section-eyebrow">Session timeline</p>
          <ol class="timeline">
            {schedule.sessions.map((session, index) => (
              <li key={`${session.game_name}-${session.date}-${index}`}>
                <article class="timeline-entry space-y-3">
                  <p class="timeline-meta">
                    {session.date} / starts {session.start_time}
                  </p>
                  <h3 class="timeline-title">{session.game_name}</h3>
                  <p class="timeline-detail">
                    {session.duration_hours.toFixed(1)} planned hours
                  </p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
