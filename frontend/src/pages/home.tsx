import { Gamepad2, Moon, Sun } from "lucide-preact";
import { useLayoutEffect, useState } from "preact/hooks";

import { PlannerAvailabilityStep } from "../components/planner-availability-step";
import { PlannerGamesStep } from "../components/planner-games-step";
import { PlannerScheduleStep } from "../components/planner-schedule-step";
import { PlannerStepActions } from "../components/planner-step-actions";
import { type PlannerTab, PlannerTabs } from "../components/planner-tabs";
import { useLanguage } from "../i18n/i18n";
import { strings } from "../i18n/strings";
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

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "gaming-clock-theme";
const DEFAULT_BACKLOG_NAMES = new Set(
  Object.values(strings).map(({ app }) => app.defaultBacklog),
);

function loadTheme(): Theme {
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light"
    ? "light"
    : "dark";
}

export function HomePage() {
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [initialState] = useState(() =>
    loadPlannerState(getLocalCalendarDate(), t.app.defaultBacklog),
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

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useLayoutEffect(() => {
    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, index) =>
        index === 0 && DEFAULT_BACKLOG_NAMES.has(backlog.name)
          ? { ...backlog, name: t.app.defaultBacklog }
          : backlog,
      ),
    );
  }, [t.app.defaultBacklog]);

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
  const gamesReady =
    games.length > 0 && !hasLoadingGames && !hasUnresolvedGames;
  const canGenerateSchedule = availability !== null && gamesReady;
  const canContinue =
    activeTab === "games"
      ? gamesReady
      : activeTab === "availability"
        ? availability !== null
        : false;
  const schedulePrerequisites = [
    ...(games.length === 0
      ? [
          {
            id: "games-required",
            message: t.app.prerequisites.games,
          },
        ]
      : []),
    ...(!availability
      ? [
          {
            id: "availability-required",
            message: t.app.prerequisites.availability,
          },
        ]
      : []),
    ...(hasLoadingGames
      ? [
          {
            id: "game-times-loading",
            message: t.app.prerequisites.loading,
          },
        ]
      : []),
    ...(hasUnresolvedGames
      ? [
          {
            id: "game-times-unavailable",
            message: t.app.prerequisites.unavailable,
          },
        ]
      : []),
  ];
  const activeStep = t.app.steps[activeTab];
  const completedTabs: PlannerTab[] = [
    ...(games.length > 0 && !hasLoadingGames && !hasUnresolvedGames
      ? (["games"] as const)
      : []),
    ...(availability ? (["availability"] as const) : []),
    ...(schedule ? (["schedule"] as const) : []),
  ];

  const resolveBacklogGame = (game: CatalogGame, backlogIndex: number) => {
    void resolveGame(game)
      .then((resolvedGame) => {
        const nextGame: ListGame = {
          ...resolvedGame,
          selected_hltb_category: "main",
        };
        setBacklogs((currentBacklogs) =>
          currentBacklogs.map((backlog, index) =>
            index === backlogIndex
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
            index === backlogIndex
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

  const addGame = (game: CatalogGame) => {
    const targetBacklogIndex = activeBacklogIndex;
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
        index === targetBacklogIndex
          ? { ...backlog, games: [...backlog.games, pendingGame] }
          : backlog,
      ),
    );
    clearGeneratedSchedule();
    resolveBacklogGame(game, targetBacklogIndex);
  };

  const retryGame = (igdbId: number) => {
    const targetBacklogIndex = activeBacklogIndex;
    const game = backlogs[targetBacklogIndex]?.games.find(
      (backlogGame) => backlogGame.igdb_id === igdbId,
    );
    if (!game) {
      return;
    }

    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, index) =>
        index === targetBacklogIndex
          ? {
              ...backlog,
              games: backlog.games.map((backlogGame) =>
                backlogGame.igdb_id === igdbId
                  ? { ...backlogGame, hltb_status: "loading" }
                  : backlogGame,
              ),
            }
          : backlog,
      ),
    );
    clearGeneratedSchedule();
    resolveBacklogGame(game, targetBacklogIndex);
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

  const moveGame = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= games.length) {
      return;
    }

    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog, backlogIndex) => {
        if (backlogIndex !== activeBacklogIndex) {
          return backlog;
        }

        const nextGames = [...backlog.games];
        const [movedGame] = nextGames.splice(index, 1);
        if (!movedGame) {
          return backlog;
        }
        nextGames.splice(targetIndex, 0, movedGame);
        return { ...backlog, games: nextGames };
      }),
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
      { name: t.app.newBacklogName(currentBacklogs.length + 1), games: [] },
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
        error instanceof Error ? error.message : t.app.scheduleFailed,
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
        error instanceof Error ? error.message : t.app.downloadFailed,
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
        {t.app.skipToPlanner}
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
                    <span class="planner-brand__title">{t.app.brand}</span>
                  </p>
                </div>
                <div class="planner-toolbar__controls">
                  <button
                    type="button"
                    class="theme-toggle"
                    aria-label={t.app.theme.switchTo(
                      theme === "dark" ? t.app.theme.light : t.app.theme.dark,
                    )}
                    aria-pressed={theme === "light"}
                    onClick={() =>
                      setTheme((currentTheme) =>
                        currentTheme === "dark" ? "light" : "dark",
                      )
                    }
                  >
                    {theme === "dark" ? (
                      <Moon aria-hidden="true" />
                    ) : (
                      <Sun aria-hidden="true" />
                    )}
                    <span>
                      {theme === "dark" ? t.app.theme.dark : t.app.theme.light}
                    </span>
                  </button>
                  <label class="language-chooser">
                    <span>{t.language.label}</span>
                    <select
                      value={language}
                      onChange={(event) =>
                        setLanguage(
                          (event.target as HTMLSelectElement)
                            .value as typeof language,
                        )
                      }
                    >
                      <option value="en">{t.language.english}</option>
                      <option value="pt-BR">{t.language.portuguese}</option>
                    </select>
                  </label>
                </div>
              </div>
            </header>
            <PlannerTabs
              activeTab={activeTab}
              completedTabs={completedTabs}
              onChange={setActiveTab}
            />
            <div class="planner-workspace__main">
              <div class="planner-toolbar__content">
                <div class="planner-toolbar__main">
                  <p class="planner-toolbar__eyebrow">{activeStep.eyebrow}</p>
                  <h1 class="planner-toolbar__title">{activeStep.title}</h1>
                </div>
                <fieldset
                  class="planner-toolbar__backlogs"
                  aria-label={t.app.backlogs}
                >
                  <legend class="sr-only">{t.app.backlogs}</legend>
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
                    {t.app.newBacklog}
                  </button>
                  <p>
                    {t.app.allBacklogs(
                      allBacklogGames.length,
                      totalAllBacklogsHours.toFixed(1),
                    )}
                  </p>
                </fieldset>
              </div>
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
                    onRetryGame={retryGame}
                    onMoveGame={moveGame}
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
                    hasSchedule={schedule !== null}
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
              <PlannerStepActions
                activeTab={activeTab}
                canContinue={canContinue}
                onChange={setActiveTab}
              />
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
