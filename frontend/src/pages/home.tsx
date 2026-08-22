import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "preact/hooks";

import { BacklogManager } from "../components/backlog-manager";
import { PlannerAvailabilityStep } from "../components/planner-availability-step";
import { PlannerGamesStep } from "../components/planner-games-step";
import { PlannerScheduleStep } from "../components/planner-schedule-step";
import { PlannerStepActions } from "../components/planner-step-actions";
import { type PlannerTab, PlannerTabs } from "../components/planner-tabs";
import { SurfaceWordmark } from "../components/surface-wordmark";
import { Button } from "../components/ui";
import { useLanguage } from "../i18n/i18n";
import { strings } from "../i18n/strings";
import {
  createCalendarUrl,
  downloadIcal,
  generateSchedule,
  getApiErrorMessage,
  resolveGame,
} from "../services/api";
import {
  createPlannerListId,
  loadPlannerState,
  savePlannerState,
} from "../services/planner-storage";
import {
  type CatalogGame,
  type GameList,
  type HLTBCategory,
  type ListGame,
  type PlanningMode,
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
  const [activeBacklogId, setActiveBacklogId] = useState(
    initialState.activeBacklogId,
  );
  const [availability, setAvailability] = useState<WeeklyAvailability | null>(
    initialState.availability,
  );
  const [algorithm, setAlgorithm] = useState<ScheduleAlgorithm>(
    initialState.algorithm,
  );
  const [planningMode, setPlanningMode] = useState<PlanningMode>(
    initialState.planningMode,
  );
  const [finishByDate, setFinishByDate] = useState<string | null>(
    initialState.finishByDate,
  );
  const [maxSessionHours, setMaxSessionHours] = useState(
    initialState.maxSessionHours,
  );
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(
    initialState.schedule,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [startDate, setStartDate] = useState(initialState.startDate);

  useLayoutEffect(() => {
    savePlannerState({
      activeTab,
      backlogs,
      activeBacklogId,
      availability,
      algorithm,
      planningMode,
      finishByDate,
      maxSessionHours,
      schedule,
      startDate,
    });
  }, [
    activeTab,
    backlogs,
    activeBacklogId,
    availability,
    algorithm,
    planningMode,
    finishByDate,
    maxSessionHours,
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

  const activeBacklog =
    backlogs.find((backlog) => backlog.id === activeBacklogId) ?? backlogs[0];
  const backlogName = activeBacklog.name;
  const games = activeBacklog.games;
  const allBacklogGames = backlogs.flatMap((backlog) => backlog.games);
  const totalAllBacklogsHours = allBacklogGames.reduce(
    (total, game) => total + getSelectedGameHours(game),
    0,
  );
  const currentListWeeklyHours = availability
    ? availability.days.reduce((total, day) => total + day.hours, 0)
    : 0;

  const clearGeneratedSchedule = useCallback(() => {
    setSchedule(null);
    setActionError("");
  }, []);

  const hasLoadingGames = games.some((game) => game.hltb_status === "loading");
  const schedulableGames = games.filter(
    (game) => game.hltb_status === "resolved" && game.main_story_hours !== null,
  );
  const excludedGames = games.filter(
    (game) => !schedulableGames.includes(game),
  );
  const gamesReady = games.length > 0 && !hasLoadingGames;
  const hasFinishByDate =
    planningMode !== "finish_by" ||
    (finishByDate !== null && finishByDate >= startDate);
  const canGenerateSchedule =
    availability !== null && gamesReady && hasFinishByDate;

  useEffect(() => {
    let isCurrent = true;

    if (!availability || !canGenerateSchedule) {
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setActionError("");
    void generateSchedule(
      backlogName,
      games,
      availability,
      algorithm,
      startDate,
      planningMode,
      finishByDate,
      maxSessionHours,
    )
      .then((result) => {
        if (isCurrent) {
          setSchedule(result);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setActionError(getApiErrorMessage(error, t.app.scheduleFailed));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsGenerating(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [
    algorithm,
    availability,
    backlogName,
    canGenerateSchedule,
    games,
    planningMode,
    finishByDate,
    maxSessionHours,
    startDate,
    t.app.scheduleFailed,
  ]);
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
            target: "games" as const,
          },
        ]
      : []),
    ...(!availability
      ? [
          {
            id: "availability-required",
            message: t.app.prerequisites.availability,
            target: "availability" as const,
          },
        ]
      : []),
    ...(hasLoadingGames
      ? [
          {
            id: "game-times-loading",
            message: t.app.prerequisites.loading,
            target: "games" as const,
          },
        ]
      : []),
  ];
  const activeStep = t.app.steps[activeTab];
  const completedTabs: PlannerTab[] = [
    ...(games.length > 0 && !hasLoadingGames ? (["games"] as const) : []),
    ...(availability ? (["availability"] as const) : []),
    ...(schedule ? (["schedule"] as const) : []),
  ];

  const resolveBacklogGame = (game: CatalogGame, backlogId: string) => {
    void resolveGame(game)
      .then((resolvedGame) => {
        const nextGame: ListGame = {
          ...resolvedGame,
          hltb_error: null,
          selected_hltb_category: "main",
        };
        setBacklogs((currentBacklogs) =>
          currentBacklogs.map((backlog) =>
            backlog.id === backlogId
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
      .catch((error: unknown) => {
        setBacklogs((currentBacklogs) =>
          currentBacklogs.map((backlog) =>
            backlog.id === backlogId
              ? {
                  ...backlog,
                  games: backlog.games.map((backlogGame) =>
                    backlogGame.igdb_id === game.igdb_id
                      ? {
                          ...backlogGame,
                          hltb_status: "unresolved",
                          hltb_error: getApiErrorMessage(
                            error,
                            t.list.unavailable,
                          ),
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
    const targetBacklogId = activeBacklogId;
    const pendingGame: ListGame = {
      ...game,
      hltb_status: "loading",
      hltb_match_name: null,
      main_story_hours: null,
      main_extra_hours: null,
      completionist_hours: null,
      hltb_error: null,
      selected_hltb_category: "main",
    };

    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog) =>
        backlog.id === targetBacklogId
          ? { ...backlog, games: [...backlog.games, pendingGame] }
          : backlog,
      ),
    );
    clearGeneratedSchedule();
    resolveBacklogGame(game, targetBacklogId);
  };

  const retryGame = (igdbId: number) => {
    const targetBacklogId = activeBacklogId;
    const game = backlogs
      .find((backlog) => backlog.id === targetBacklogId)
      ?.games.find((backlogGame) => backlogGame.igdb_id === igdbId);
    if (!game) {
      return;
    }

    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog) =>
        backlog.id === targetBacklogId
          ? {
              ...backlog,
              games: backlog.games.map((backlogGame) =>
                backlogGame.igdb_id === igdbId
                  ? {
                      ...backlogGame,
                      hltb_status: "loading",
                      hltb_error: null,
                    }
                  : backlogGame,
              ),
            }
          : backlog,
      ),
    );
    clearGeneratedSchedule();
    resolveBacklogGame(game, targetBacklogId);
  };

  const removeGame = (igdbId: number) => {
    setBacklogs((currentBacklogs) =>
      currentBacklogs.map((backlog) =>
        backlog.id === activeBacklogId
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
      currentBacklogs.map((backlog) =>
        backlog.id === activeBacklogId
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
      currentBacklogs.map((backlog) => {
        if (backlog.id !== activeBacklogId) {
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
      currentBacklogs.map((backlog) =>
        backlog.id === activeBacklogId ? { ...backlog, name } : backlog,
      ),
    );
  };

  const addBacklog = (name: string) => {
    const nextBacklog: GameList = {
      id: createPlannerListId(),
      name,
      games: [],
    };
    setBacklogs((currentBacklogs) => [...currentBacklogs, nextBacklog]);
    setActiveBacklogId(nextBacklog.id);
    clearGeneratedSchedule();
  };

  const deleteBacklog = (backlogId: string) => {
    if (backlogs.length === 1) {
      return;
    }

    const deletedIndex = backlogs.findIndex(
      (backlog) => backlog.id === backlogId,
    );
    setBacklogs((currentBacklogs) =>
      currentBacklogs.filter((backlog) => backlog.id !== backlogId),
    );

    if (backlogId === activeBacklogId) {
      const nextBacklog =
        backlogs[deletedIndex + 1] ?? backlogs[deletedIndex - 1];
      if (nextBacklog) {
        setActiveBacklogId(nextBacklog.id);
      }
    }
    clearGeneratedSchedule();
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
        planningMode,
        finishByDate,
        maxSessionHours,
        schedule?.sessions ?? null,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "gaming-clock.ics";
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      setActionError(getApiErrorMessage(error, t.app.downloadFailed));
      return false;
    }
  };

  const handleCopyCalendarUrl = async (): Promise<boolean> => {
    if (!schedule) {
      return false;
    }
    setActionError("");
    try {
      const calendarUrl = await createCalendarUrl(
        backlogName,
        schedule.sessions,
      );
      await navigator.clipboard.writeText(calendarUrl);
      return true;
    } catch {
      setActionError(t.app.calendarUrlFailed);
      return false;
    }
  };

  const handleSetAvailability = useCallback(
    (nextAvailability: WeeklyAvailability | null) => {
      setAvailability(nextAvailability);
      clearGeneratedSchedule();
    },
    [clearGeneratedSchedule],
  );

  const handleAlgorithmChange = (nextAlgorithm: ScheduleAlgorithm) => {
    setAlgorithm(nextAlgorithm);
    clearGeneratedSchedule();
  };

  const handleStartDateChange = (nextStartDate: string) => {
    setStartDate(nextStartDate);
    clearGeneratedSchedule();
  };

  const handlePlanningModeChange = (nextPlanningMode: PlanningMode) => {
    setPlanningMode(nextPlanningMode);
    clearGeneratedSchedule();
  };

  const handleFinishByDateChange = (nextFinishByDate: string) => {
    setFinishByDate(nextFinishByDate || null);
    clearGeneratedSchedule();
  };

  const handleMaxSessionHoursChange = (nextMaxSessionHours: number) => {
    setMaxSessionHours(nextMaxSessionHours);
    clearGeneratedSchedule();
  };

  const handleScheduleChange = (nextSchedule: ScheduleResponse) => {
    setSchedule(nextSchedule);
    setActionError("");
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
                <SurfaceWordmark text="Gaming Clock" />
                <div class="planner-toolbar__controls">
                  <div class="toolbar-control">
                    <span class="toolbar-control__label">
                      {t.app.theme.label}
                    </span>
                    <Button
                      unstyled
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
                        <MoonIcon aria-hidden="true" />
                      ) : (
                        <SunIcon aria-hidden="true" />
                      )}
                      <span>
                        {theme === "dark"
                          ? t.app.theme.dark
                          : t.app.theme.light}
                      </span>
                    </Button>
                  </div>
                  <label class="toolbar-control language-chooser">
                    <span class="toolbar-control__label">
                      {t.language.label}
                    </span>
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
                  <BacklogManager
                    backlogs={backlogs}
                    activeBacklogId={activeBacklog.id}
                    onSelect={(backlogId) => {
                      setActiveBacklogId(backlogId);
                      clearGeneratedSchedule();
                    }}
                    onCreate={addBacklog}
                    onDelete={deleteBacklog}
                  />
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
                  <h1 class="planner-toolbar__title">{activeStep.title}</h1>
                </div>
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
                    planningMode={planningMode}
                    onChange={handleSetAvailability}
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
                    gameListName={backlogName}
                    games={games}
                    excludedGames={excludedGames}
                    gameCount={schedulableGames.length}
                    totalSelectedHours={schedulableGames.reduce(
                      (total, game) => total + getSelectedGameHours(game),
                      0,
                    )}
                    weeklyHours={currentListWeeklyHours}
                    algorithm={algorithm}
                    startDate={startDate}
                    planningMode={planningMode}
                    finishByDate={finishByDate}
                    maxSessionHours={maxSessionHours}
                    schedule={schedule}
                    isGenerating={isGenerating}
                    actionError={actionError}
                    canGenerateSchedule={canGenerateSchedule}
                    prerequisiteMessages={schedulePrerequisites}
                    onNavigate={setActiveTab}
                    onAlgorithmChange={handleAlgorithmChange}
                    onStartDateChange={handleStartDateChange}
                    onPlanningModeChange={handlePlanningModeChange}
                    onFinishByDateChange={handleFinishByDateChange}
                    onMaxSessionHoursChange={handleMaxSessionHoursChange}
                    onScheduleChange={handleScheduleChange}
                    onDownloadIcal={handleDownloadIcal}
                    onCopyCalendarUrl={handleCopyCalendarUrl}
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
      <footer class="planner-footer">
        <p>
          Made with love by 🧡💜{" "}
          <a href="https://fofinhos.studio">fofinhos.studio</a>
        </p>
      </footer>
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
