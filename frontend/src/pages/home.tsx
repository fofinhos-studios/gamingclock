import type { RoutableProps } from "preact-router";
import { useState } from "preact/hooks";

import { PlannerAvailabilityStep } from "../components/planner-availability-step";
import { PlannerGamesStep } from "../components/planner-games-step";
import { PlannerScheduleStep } from "../components/planner-schedule-step";
import { type PlannerTab, PlannerTabs } from "../components/planner-tabs";
import { Card } from "../components/ui";
import { downloadIcal, generateSchedule } from "../services/api";
import type {
  ListGame,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

export function HomePage(_props: RoutableProps) {
  const [activeTab, setActiveTab] = useState<PlannerTab>("games");
  const [backlogName, setBacklogName] = useState("My Backlog");
  const [games, setGames] = useState<ListGame[]>([]);
  const [availability, setAvailability] = useState<WeeklyAvailability | null>(
    null,
  );
  const [algorithm, setAlgorithm] = useState<ScheduleAlgorithm>("sequential");
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [actionError, setActionError] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );

  const unresolvedGames = games.filter(
    (game) =>
      game.hltb_status === "unresolved" || game.main_story_hours === null,
  );
  const canGenerateSchedule =
    availability !== null && games.length > 0 && unresolvedGames.length === 0;

  const addGame = (game: ListGame) => {
    setGames((currentGames) => [...currentGames, game]);
    setSchedule(null);
    setActionError("");
  };

  const removeGame = (index: number) => {
    setGames((currentGames) =>
      currentGames.filter((_, gameIndex) => gameIndex !== index),
    );
    setSchedule(null);
    setActionError("");
  };

  const handleGenerateSchedule = async () => {
    if (!availability || games.length === 0 || unresolvedGames.length > 0) {
      return;
    }
    setActionError("");
    try {
      const result = await generateSchedule(
        backlogName,
        games,
        availability,
        algorithm,
        startDate,
      );
      setSchedule(result);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Schedule generation failed",
      );
    }
  };

  const handleDownloadIcal = async () => {
    if (!availability || games.length === 0 || unresolvedGames.length > 0) {
      return;
    }
    setActionError("");
    try {
      const blob = await downloadIcal(
        backlogName,
        games,
        availability,
        algorithm,
        startDate,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "gaming-clock.ics";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "iCal download failed",
      );
    }
  };

  const handleSetAvailability = (nextAvailability: WeeklyAvailability) => {
    setAvailability(nextAvailability);
    setSchedule(null);
    setActionError("");
  };

  return (
    <div class="page-shell">
      <a href="#planner" class="skip-link">
        Skip to planner
      </a>

      <main id="planner" class="px-4 py-8 md:px-6 md:py-12">
        <div class="mx-auto max-w-6xl">
          <Card class="p-6 md:p-8">
            <div class="space-y-6">
              <header class="space-y-3">
                <p class="section-eyebrow">Planner</p>
                <h1 class="text-5xl leading-none md:text-6xl">Gaming Clock</h1>
                <p class="max-w-2xl text-lg text-[var(--muted-foreground)]">
                  Build one backlog, set weekly time, and generate a realistic
                  play schedule.
                </p>
              </header>

              <PlannerTabs activeTab={activeTab} onChange={setActiveTab} />

              <section
                id="planner-panel-games"
                role="tabpanel"
                aria-labelledby="planner-tab-games"
                hidden={activeTab !== "games"}
                class="min-w-0"
              >
                <PlannerGamesStep
                  backlogName={backlogName}
                  games={games}
                  onAddGame={addGame}
                  onRemoveGame={removeGame}
                  onRenameBacklog={setBacklogName}
                />
              </section>

              <section
                id="planner-panel-availability"
                role="tabpanel"
                aria-labelledby="planner-tab-availability"
                hidden={activeTab !== "availability"}
                class="min-w-0"
              >
                <PlannerAvailabilityStep
                  availability={availability}
                  gameCount={games.length}
                  onSubmit={handleSetAvailability}
                />
              </section>

              <section
                id="planner-panel-schedule"
                role="tabpanel"
                aria-labelledby="planner-tab-schedule"
                hidden={activeTab !== "schedule"}
                class="min-w-0"
              >
                <PlannerScheduleStep
                  availability={availability}
                  algorithm={algorithm}
                  startDate={startDate}
                  schedule={schedule}
                  actionError={actionError}
                  canGenerateSchedule={canGenerateSchedule}
                  onAlgorithmChange={setAlgorithm}
                  onStartDateChange={setStartDate}
                  onGenerateSchedule={() => void handleGenerateSchedule()}
                  onDownloadIcal={() => void handleDownloadIcal()}
                />
              </section>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
