import { Gamepad2 } from "lucide-preact";
import type { RoutableProps } from "preact-router";
import { useState } from "preact/hooks";

import { PlannerAvailabilityStep } from "../components/planner-availability-step";
import { PlannerGamesStep } from "../components/planner-games-step";
import { PlannerScheduleStep } from "../components/planner-schedule-step";
import { PlannerSummary } from "../components/planner-summary";
import { type PlannerTab, PlannerTabs } from "../components/planner-tabs";
import { downloadIcal, generateSchedule } from "../services/api";
import type {
  ListGame,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

const TAB_CONTENT: Record<PlannerTab, { title: string; eyebrow: string }> = {
  games: {
    title: "Build backlog",
    eyebrow: "Step 01",
  },
  availability: {
    title: "Set weekly time",
    eyebrow: "Step 02",
  },
  schedule: {
    title: "Generate schedule",
    eyebrow: "Step 03",
  },
};

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
  const [startDate, setStartDate] = useState(getLocalCalendarDate());

  const clearGeneratedSchedule = () => {
    setSchedule(null);
    setActionError("");
  };

  const resolvedHours = games.reduce(
    (total, game) => total + (game.main_story_hours ?? 0),
    0,
  );
  const canGenerateSchedule = availability !== null && games.length > 0;
  const schedulePrerequisites = [
    ...(games.length === 0
      ? [
          {
            id: "games-required",
            message:
              "Add at least one game to the backlog before generating a schedule.",
          },
        ]
      : []),
    ...(!availability
      ? [
          {
            id: "availability-required",
            message:
              "Set your weekly availability before generating a schedule.",
          },
        ]
      : []),
  ];
  const availabilityStatus = availability ? "Set" : "Missing";
  const availabilityDetail = availability
    ? `${availability.days.length} day${availability.days.length === 1 ? "" : "s"} configured`
    : "No weekly cadence saved";
  const totalElapsedDays = getScheduleElapsedDays(schedule);
  const scheduleStatus = schedule
    ? "Generated"
    : games.length === 0
      ? "Add games"
      : !availability
        ? "Set availability"
        : "Ready to generate";
  const scheduleDetail = schedule
    ? `Finishes ${schedule.estimated_end_date ?? "when sessions complete"}`
    : (schedulePrerequisites[0]?.message ??
      "Generate the schedule when you're ready.");
  const activeStep = TAB_CONTENT[activeTab];

  const addGame = (game: ListGame) => {
    setGames((currentGames) => [...currentGames, game]);
    clearGeneratedSchedule();
  };

  const removeGame = (index: number) => {
    setGames((currentGames) =>
      currentGames.filter((_, gameIndex) => gameIndex !== index),
    );
    clearGeneratedSchedule();
  };

  const handleGenerateSchedule = async (): Promise<boolean> => {
    if (!availability || games.length === 0) {
      return false;
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
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Schedule generation failed",
      );
      return false;
    }
  };

  const handleDownloadIcal = async (): Promise<boolean> => {
    if (!availability || games.length === 0) {
      return false;
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
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "iCal download failed",
      );
      return false;
    }
  };

  const handleSetAvailability = (nextAvailability: WeeklyAvailability) => {
    setAvailability(nextAvailability);
    clearGeneratedSchedule();
  };

  const handleAlgorithmChange = (nextAlgorithm: ScheduleAlgorithm) => {
    setAlgorithm(nextAlgorithm);
    clearGeneratedSchedule();
  };

  const handleStartDateChange = (nextStartDate: string) => {
    setStartDate(nextStartDate);
    clearGeneratedSchedule();
  };

  return (
    <div class="page-shell">
      <a href="#planner" class="skip-link">
        Skip to planner
      </a>

      <main id="planner" class="planner-app">
        <div class="planner-app__frame">
          <div class="planner-app__rail">
            <div class="planner-brand">
              <p class="planner-brand__name">
                <Gamepad2
                  class="planner-icon planner-brand__icon"
                  aria-hidden="true"
                />
                <span>Gaming Clock</span>
              </p>
            </div>

            <PlannerTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>

          <div class="planner-app__workspace">
            <header class="planner-toolbar">
              <div class="planner-toolbar__main">
                <p class="planner-toolbar__eyebrow">{activeStep.eyebrow}</p>
                <h1 class="planner-toolbar__title">{activeStep.title}</h1>
              </div>
            </header>

            <PlannerSummary
              backlogName={backlogName}
              trackedGameCount={games.length}
              resolvedHours={resolvedHours}
              availabilityStatus={availabilityStatus}
              availabilityDetail={availabilityDetail}
              scheduleStatus={scheduleStatus}
              scheduleDetail={scheduleDetail}
              totalPlannedHours={schedule?.total_hours}
              totalSessions={schedule?.sessions.length}
              estimatedFinishDate={schedule?.estimated_end_date}
              totalElapsedDays={totalElapsedDays}
            />

            <div class="planner-workspace__body">
              <section
                id="planner-panel-games"
                role="tabpanel"
                aria-labelledby="planner-tab-games"
                hidden={activeTab !== "games"}
                class="planner-panel"
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
                class="planner-panel"
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
                class="planner-panel"
              >
                <PlannerScheduleStep
                  availability={availability}
                  algorithm={algorithm}
                  startDate={startDate}
                  schedule={schedule}
                  actionError={actionError}
                  canGenerateSchedule={canGenerateSchedule}
                  prerequisiteMessages={schedulePrerequisites}
                  onAlgorithmChange={handleAlgorithmChange}
                  onStartDateChange={handleStartDateChange}
                  onGenerateSchedule={handleGenerateSchedule}
                  onDownloadIcal={handleDownloadIcal}
                />
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function getScheduleElapsedDays(
  schedule: ScheduleResponse | null,
): number | null {
  const firstSessionDate = schedule?.sessions[0]?.date;
  const lastDate = schedule?.sessions.at(-1)?.date;

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

function getLocalCalendarDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
