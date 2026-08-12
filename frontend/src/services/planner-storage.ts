import type { PlannerTab } from "../components/planner-tabs";
import type {
  GameList,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

const STORAGE_KEY = "gaming-clock.planner.v1";

export interface PlannerState {
  activeTab: PlannerTab;
  backlogs: GameList[];
  activeBacklogIndex: number;
  availability: WeeklyAvailability | null;
  algorithm: ScheduleAlgorithm;
  schedule: ScheduleResponse | null;
  startDate: string;
}

export function createInitialPlannerState(startDate: string): PlannerState {
  return {
    activeTab: "games",
    backlogs: [{ name: "My Backlog", games: [] }],
    activeBacklogIndex: 0,
    availability: null,
    algorithm: "sequential",
    schedule: null,
    startDate,
  };
}

export function loadPlannerState(startDate: string): PlannerState {
  try {
    const storedState = window.localStorage.getItem(STORAGE_KEY);
    if (!storedState) {
      return createInitialPlannerState(startDate);
    }

    const parsedState: unknown = JSON.parse(storedState);
    return isPlannerState(parsedState)
      ? parsedState
      : createInitialPlannerState(startDate);
  } catch {
    return createInitialPlannerState(startDate);
  }
}

export function savePlannerState(state: PlannerState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

function isPlannerState(value: unknown): value is PlannerState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPlannerTab(value.activeTab) &&
    isBacklogList(value.backlogs) &&
    isActiveBacklogIndex(value.activeBacklogIndex, value.backlogs.length) &&
    isAvailability(value.availability) &&
    (value.algorithm === "sequential" || value.algorithm === "alternating") &&
    isSchedule(value.schedule) &&
    typeof value.startDate === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlannerTab(value: unknown): value is PlannerTab {
  return value === "games" || value === "availability" || value === "schedule";
}

function isBacklogList(value: unknown): value is GameList[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (backlog) =>
        isRecord(backlog) &&
        typeof backlog.name === "string" &&
        Array.isArray(backlog.games),
    )
  );
}

function isActiveBacklogIndex(value: unknown, backlogCount: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < backlogCount
  );
}

function isAvailability(value: unknown): value is WeeklyAvailability | null {
  return (
    value === null ||
    (isRecord(value) &&
      Array.isArray(value.days) &&
      value.days.every(
        (day) =>
          isRecord(day) &&
          typeof day.day_of_week === "number" &&
          typeof day.hours === "number" &&
          typeof day.start_hour === "number",
      ))
  );
}

function isSchedule(value: unknown): value is ScheduleResponse | null {
  return (
    value === null ||
    (isRecord(value) &&
      Array.isArray(value.sessions) &&
      typeof value.total_hours === "number" &&
      (typeof value.estimated_end_date === "string" ||
        value.estimated_end_date === null))
  );
}
