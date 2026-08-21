import type { PlannerTab } from "../components/planner-tabs";
import type {
  DayAvailability,
  GameList,
  HLTBCategory,
  ListGame,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

const STORAGE_KEY = "gaming-clock.planner.v2";
const LEGACY_STORAGE_KEY = "gaming-clock.planner.v1";

export interface PlannerState {
  activeTab: PlannerTab;
  backlogs: GameList[];
  activeBacklogId: string;
  availability: WeeklyAvailability | null;
  algorithm: ScheduleAlgorithm;
  schedule: ScheduleResponse | null;
  startDate: string;
}

export function createPlannerListId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `list-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createInitialPlannerState(
  startDate: string,
  defaultBacklogName = "My Backlog",
): PlannerState {
  const initialBacklog = {
    id: createPlannerListId(),
    name: defaultBacklogName,
    games: [],
  } satisfies GameList;

  return {
    activeTab: "games",
    backlogs: [initialBacklog],
    activeBacklogId: initialBacklog.id,
    availability: null,
    algorithm: "sequential",
    schedule: null,
    startDate,
  };
}

export function loadPlannerState(
  startDate: string,
  defaultBacklogName = "My Backlog",
): PlannerState {
  const currentState = parsePlannerState(readStoredValue(STORAGE_KEY));
  if (currentState) {
    return currentState;
  }

  const legacyState = migrateLegacyState(readStoredValue(LEGACY_STORAGE_KEY));
  if (legacyState) {
    savePlannerState(legacyState);
    return legacyState;
  }

  return createInitialPlannerState(startDate, defaultBacklogName);
}

export function savePlannerState(state: PlannerState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

function readStoredValue(key: string): unknown {
  try {
    const storedState = window.localStorage.getItem(key);
    return storedState ? JSON.parse(storedState) : null;
  } catch {
    return null;
  }
}

function migrateLegacyState(value: unknown): PlannerState | null {
  if (!isLegacyPlannerState(value)) {
    return null;
  }

  const backlogs = value.backlogs.map((backlog) => ({
    ...backlog,
    id: createPlannerListId(),
  }));

  return {
    activeTab: value.activeTab,
    backlogs,
    activeBacklogId: backlogs[value.activeBacklogIndex].id,
    availability: value.availability,
    algorithm: value.algorithm,
    schedule: value.schedule,
    startDate: value.startDate,
  };
}

function parsePlannerState(value: unknown): PlannerState | null {
  if (!isRecord(value) || !isPlannerTab(value.activeTab)) {
    return null;
  }

  if (
    !isBacklogList(value.backlogs) ||
    !isAvailability(value.availability) ||
    !isScheduleAlgorithm(value.algorithm) ||
    !isSchedule(value.schedule) ||
    typeof value.startDate !== "string" ||
    value.startDate.length === 0
  ) {
    return null;
  }

  const activeBacklogId = isActiveBacklogId(
    value.activeBacklogId,
    value.backlogs,
  )
    ? value.activeBacklogId
    : value.backlogs[0].id;

  return {
    activeTab: value.activeTab,
    backlogs: value.backlogs,
    activeBacklogId,
    availability: value.availability,
    algorithm: value.algorithm,
    schedule: value.schedule,
    startDate: value.startDate,
  };
}

function isLegacyPlannerState(value: unknown): value is LegacyPlannerState {
  if (!isRecord(value) || !isPlannerTab(value.activeTab)) {
    return false;
  }

  return (
    isLegacyBacklogList(value.backlogs) &&
    isActiveBacklogIndex(value.activeBacklogIndex, value.backlogs.length) &&
    isAvailability(value.availability) &&
    isScheduleAlgorithm(value.algorithm) &&
    isSchedule(value.schedule) &&
    typeof value.startDate === "string" &&
    value.startDate.length > 0
  );
}

interface LegacyPlannerState {
  activeTab: PlannerTab;
  backlogs: LegacyGameList[];
  activeBacklogIndex: number;
  availability: WeeklyAvailability | null;
  algorithm: ScheduleAlgorithm;
  schedule: ScheduleResponse | null;
  startDate: string;
}

type LegacyGameList = Omit<GameList, "id">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlannerTab(value: unknown): value is PlannerTab {
  return value === "games" || value === "availability" || value === "schedule";
}

function isScheduleAlgorithm(value: unknown): value is ScheduleAlgorithm {
  return value === "sequential" || value === "alternating";
}

function isBacklogList(value: unknown): value is GameList[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const ids = new Set<string>();
  return value.every((backlog) => {
    if (
      !isRecord(backlog) ||
      typeof backlog.id !== "string" ||
      backlog.id.length === 0 ||
      ids.has(backlog.id) ||
      typeof backlog.name !== "string" ||
      !isGameList(backlog.games)
    ) {
      return false;
    }
    ids.add(backlog.id);
    return true;
  });
}

function isLegacyBacklogList(value: unknown): value is LegacyGameList[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (backlog) =>
        isRecord(backlog) &&
        typeof backlog.name === "string" &&
        isGameList(backlog.games),
    )
  );
}

function isGameList(value: unknown): value is ListGame[] {
  return Array.isArray(value) && value.every(isListGame);
}

function isListGame(value: unknown): value is ListGame {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.igdb_id === "number" &&
    typeof value.name === "string" &&
    typeof value.cover_url === "string" &&
    typeof value.summary === "string" &&
    isStringArray(value.genres) &&
    isStringArray(value.platforms) &&
    isNullableNumber(value.release_year) &&
    isNullableNumber(value.rating) &&
    isHLTBStatus(value.hltb_status) &&
    (value.hltb_error === undefined || isNullableString(value.hltb_error)) &&
    isNullableString(value.hltb_match_name) &&
    isNullableNumber(value.main_story_hours) &&
    isNullableNumber(value.main_extra_hours) &&
    isNullableNumber(value.completionist_hours) &&
    (value.selected_hltb_category === undefined ||
      isHLTBCategory(value.selected_hltb_category))
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isHLTBStatus(value: unknown): value is ListGame["hltb_status"] {
  return value === "loading" || value === "resolved" || value === "unresolved";
}

function isHLTBCategory(value: unknown): value is HLTBCategory {
  return value === "main" || value === "extras" || value === "completionist";
}

function isActiveBacklogId(
  value: unknown,
  backlogs: GameList[],
): value is string {
  return (
    typeof value === "string" &&
    backlogs.some((backlog) => backlog.id === value)
  );
}

function isActiveBacklogIndex(
  value: unknown,
  backlogCount: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < backlogCount
  );
}

function isAvailability(value: unknown): value is WeeklyAvailability | null {
  return (
    value === null || (isRecord(value) && isDayAvailabilityList(value.days))
  );
}

function isDayAvailabilityList(value: unknown): value is DayAvailability[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every(isDayAvailability)
  );
}

function isDayAvailability(value: unknown): value is DayAvailability {
  return (
    isRecord(value) &&
    typeof value.day_of_week === "number" &&
    Number.isInteger(value.day_of_week) &&
    value.day_of_week >= 0 &&
    value.day_of_week <= 6 &&
    typeof value.hours === "number" &&
    Number.isFinite(value.hours) &&
    value.hours > 0 &&
    typeof value.start_hour === "number" &&
    Number.isInteger(value.start_hour) &&
    value.start_hour >= 0 &&
    value.start_hour <= 23
  );
}

function isSchedule(value: unknown): value is ScheduleResponse | null {
  return (
    value === null ||
    (isRecord(value) &&
      Array.isArray(value.sessions) &&
      value.sessions.every(isPlaySession) &&
      typeof value.total_hours === "number" &&
      Number.isFinite(value.total_hours) &&
      (typeof value.estimated_end_date === "string" ||
        value.estimated_end_date === null))
  );
}

function isPlaySession(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.game_name === "string" &&
    typeof value.date === "string" &&
    typeof value.start_time === "string" &&
    typeof value.duration_hours === "number" &&
    Number.isFinite(value.duration_hours)
  );
}
