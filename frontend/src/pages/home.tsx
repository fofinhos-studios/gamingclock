import { Gamepad2 } from "lucide-preact";
import type { RoutableProps } from "preact-router";
import { useLayoutEffect, useState } from "preact/hooks";

import { PlannerAvailabilityStep } from "../components/planner-availability-step";
import { PlannerGamesStep } from "../components/planner-games-step";
import { PlannerScheduleStep } from "../components/planner-schedule-step";
import { type PlannerTab, PlannerTabs } from "../components/planner-tabs";
import { downloadIcal, generateSchedule, resolveGame } from "../services/api";
import {
  loadPlannerState,
  savePlannerState,
} from "../services/planner-storage";
import {
  type CatalogGame,
  type GameList,
  type HLTBCategory,
  type ListGame,
  type ScheduleAlgorithm,
  type ScheduleResponse,
  type WeeklyAvailability,
  getSelectedGameHours,
} from "../types";

const TAB_CONTENT: Record<PlannerTab, { title: string; eyebrow: string }> = {
  games: {
    title: "Build backlog",
    eyebrow: "Start here — add the games you want to play",
  },
  availability: {
    title: "Choose your weekly play time",
    eyebrow: "Tell us when you usually have time to play",
  },
  schedule: {
    title: "Make your schedule",
    eyebrow: "Turn your backlog and free time into a play plan",
  },
};

export function HomePage(_props: RoutableProps) {
  const [initialState] = useState(() =>
    loadPlannerState(getLocalCalendarDate()),
  );
  const [activeTab, setActiveTab] = useState<PlannerTab>(
    initialState.activeTab,
  );
  const [backlogs, setBacklogs] = useState<GameList[]>(initialState.backlogs);
  const [activeBacklogIndex, setActiveBacklogIndex] = useState(
    initialState.activeBacklogIndex,
  );
  const [availability, setAvailability] = useState<WeeklyAvailability | null>(
    initialState.availability,
  );
  const [algorithm, setAlgorithm] = useState<ScheduleAlgorithm>(
    initialState.algorithm,
  );
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(
    initialState.schedule,
  );
  const [actionError, setActionError] = useState("");
  const [startDate, setStartDate] = useState(initialState.startDate);

  useLayoutEffect(() => {
    savePlannerState({
      activeTab,
      backlogs,
      activeBacklogIndex,
      availability,
      algorithm,
      schedule,
      startDate,
    });
  }, [
    activeTab,
    backlogs,
    activeBacklogIndex,
    availability,
    algorithm,
    schedule,
    startDate,
  ]);
  const activeBacklog = backlogs[activeBacklogIndex];
  const backlogName = activeBacklog.name;
  const games = activeBacklog.games;
  const allBacklogGames = backlogs.flatMap((backlog) => backlog.games);
  const totalAllBacklogsHours = allBacklogGames.reduce(
    (total, game) => total + getSelectedGameHours(game),
    0,
  );

  const clearGeneratedSchedule = () => {
    setSchedule(null);
    setActionError("");
  };

  const hasLoadingGames = games.some((game) => game.hltb_status === "loading");
  const hasUnresolvedGames = games.some(
    (game) => game.hltb_status === "unresolved",
  );
  const canGenerateSchedule =
    availability !== null &&
    games.length > 0 &&
    !hasLoadingGames &&
    !hasUnresolvedGames;
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
    ...(hasLoadingGames
      ? [
          {
            id: "game-times-loading",
            message: "We're retrieving playtime estimates for your games.",
          },
        ]
      : []),
    ...(hasUnresolvedGames
      ? [
          {
            id: "game-times-unavailable",
            message:
              "A playtime estimate is unavailable for one or more games.",
          },
        ]
      : []),
  ];
  const activeStep = TAB_CONTENT[activeTab];
  const completedTabs: PlannerTab[] = [
    ...(games.length > 0 && !hasLoadingGames && !hasUnresolvedGames
      ? (["games"] as const)
      : []),
    ...(availability ? (["availability"] as const) : []),
    ...(schedule ? (["schedule"] as const) : []),
  ];

  const addGame = (game: CatalogGame) => {
    const pendingGame: ListGame = {
      ...game,
      hltb_status: "loading",
      hltb_match_name: null,
      main_story_hours: null,
      main_extra_hours: null,
      completionist_hours: null,
      selected_hltb_category: "main",
    };

    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, index) =>
        index === activeBacklogIndex
          ? { ...backlog, games: [...backlog.games, pendingGame] }
          : backlog,
      ),
    );
    clearGeneratedSchedule();

    void resolveGame(game)
      .then((resolvedGame) => {
        const nextGame: ListGame = {
          ...resolvedGame,
          selected_hltb_category: "main",
        };
        setBacklogs((currentBacklogs) =>
          currentBacklogs.map((backlog, index) =>
            index === activeBacklogIndex
              ? {
                  ...backlog,
                  games: backlog.games.map((backlogGame) =>
                    backlogGame.igdb_id === game.igdb_id
                      ? nextGame
                      : backlogGame,
                  ),
                }
              : backlog,
          ),
        );
      })
      .catch(() => {
        setBacklogs((currentBacklogs) =>
          currentBacklogs.map((backlog, index) =>
            index === activeBacklogIndex
              ? {
                  ...backlog,
                  games: backlog.games.map((backlogGame) =>
                    backlogGame.igdb_id === game.igdb_id
                      ? {
                          ...backlogGame,
                          hltb_status: "unresolved",
                        }
                      : backlogGame,
                  ),
                }
              : backlog,
          ),
        );
      });
  };

  const removeGame = (igdbId: number) => {
    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, backlogIndex) =>
        backlogIndex === activeBacklogIndex
          ? {
              ...backlog,
              games: backlog.games.filter((game) => game.igdb_id !== igdbId),
            }
          : backlog,
      ),
    );
    clearGeneratedSchedule();
  };

  const selectGameTime = (index: number, category: HLTBCategory) => {
    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, backlogIndex) =>
        backlogIndex === activeBacklogIndex
          ? {
              ...backlog,
              games: backlog.games.map((game, gameIndex) =>
                gameIndex === index
                  ? { ...game, selected_hltb_category: category }
                  : game,
              ),
            }
          : backlog,
      ),
    );
    clearGeneratedSchedule();
  };

  const renameBacklog = (name: string) => {
    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, index) =>
        index === activeBacklogIndex ? { ...backlog, name } : backlog,
      ),
    );
  };

  const addBacklog = () => {
    setBacklogs((currentBacklogs) => [
      ...currentBacklogs,
      { name: `Backlog ${currentBacklogs.length + 1}`, games: [] },
    ]);
    setActiveBacklogIndex(backlogs.length);
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
          <div class="planner-app__workspace">
            <header class="planner-toolbar">
              <div class="planner-toolbar__topline">
                <div class="planner-brand">
                  <p class="planner-brand__name">
                    <Gamepad2
                      class="planner-icon planner-brand__icon"
                      aria-hidden="true"
                    />
                    <span>Gaming Clock</span>
                  </p>
                </div>
                <PlannerTabs
                  activeTab={activeTab}
                  completedTabs={completedTabs}
                  onChange={setActiveTab}
                />
              </div>
              <div class="planner-toolbar__content">
                <div class="planner-toolbar__main">
                  <p class="planner-toolbar__eyebrow">{activeStep.eyebrow}</p>
                  <h1 class="planner-toolbar__title">{activeStep.title}</h1>
                </div>
                <fieldset class="planner-toolbar__backlogs">
                  <legend class="sr-only">Backlogs</legend>
                  {backlogs.map((backlog, index) => (
                    <button
                      key={`${backlog.name}-${index}`}
                      type="button"
                      aria-pressed={index === activeBacklogIndex}
                      onClick={() => {
                        setActiveBacklogIndex(index);
                        clearGeneratedSchedule();
                      }}
                    >
                      {backlog.name}
                    </button>
                  ))}
                  <button type="button" onClick={addBacklog}>
                    New backlog
                  </button>
                  <p>
                    All backlogs: {allBacklogGames.length} games,{" "}
                    {totalAllBacklogsHours.toFixed(1)}h
                  </p>
                </fieldset>
              </div>
            </header>

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
                  onSelectGameTime={selectGameTime}
                  onRemoveGame={removeGame}
                  onRenameBacklog={renameBacklog}
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

function getLocalCalendarDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
