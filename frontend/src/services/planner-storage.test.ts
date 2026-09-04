import { describe, expect, test } from "vitest";

import {
  createInitialPlannerState,
  loadPlannerState,
  savePlannerState,
} from "./planner-storage";

const resolvedGame = {
  igdb_id: 7,
  name: "Final Fantasy VII",
  cover_url: "https://example.com/ff7.png",
  summary: "Classic RPG",
  genres: ["RPG"],
  platforms: ["PlayStation"],
  release_year: 1997,
  rating: 95,
  hltb_status: "resolved",
  hltb_match_name: "Final Fantasy VII",
  main_story_hours: 36,
  main_extra_hours: 52,
  completionist_hours: 80,
  selected_hltb_category: "completionist",
};

describe("planner storage", () => {
  test("migrates v1 index-based state without losing list order or duration choice", () => {
    window.localStorage.setItem(
      "gaming-clock.planner.v1",
      JSON.stringify({
        activeTab: "schedule",
        backlogs: [
          { name: "First list", games: [] },
          { name: "Weekend RPGs", games: [resolvedGame] },
        ],
        activeBacklogIndex: 1,
        availability: {
          days: [{ day_of_week: 6, hours: 3, start_hour: 10 }],
        },
        algorithm: "alternating",
        schedule: null,
        startDate: "2026-08-22",
      }),
    );

    const state = loadPlannerState("2026-08-21");

    expect(state.activeBacklogId).toBe(state.backlogs[1].id);
    expect(state.backlogs.map(({ name }) => name)).toEqual([
      "First list",
      "Weekend RPGs",
    ]);
    expect(state.backlogs[1].games[0]).toMatchObject(resolvedGame);
    expect(state.backlogs[0].id).not.toBe(state.backlogs[1].id);
    expect(
      window.localStorage.getItem("gaming-clock.planner.v2"),
    ).not.toBeNull();
  });

  test("preserves stable list identity across saves and reloads", () => {
    const initialState = createInitialPlannerState("2026-08-21");
    savePlannerState(initialState);

    const reloadedState = loadPlannerState("2026-08-21");

    expect(reloadedState.activeBacklogId).toBe(initialState.activeBacklogId);
    expect(reloadedState.backlogs[0].id).toBe(initialState.backlogs[0].id);
    expect(reloadedState.planningMode).toBe("weekly");
    expect(reloadedState.maxSessionHours).toBe(4);
  });

  test("defaults older saved planners to weekly mode", () => {
    window.localStorage.setItem(
      "gaming-clock.planner.v2",
      JSON.stringify({
        activeTab: "games",
        activeBacklogId: "list-a",
        backlogs: [{ id: "list-a", name: "First", games: [] }],
        availability: null,
        algorithm: "sequential",
        schedule: null,
        startDate: "2026-08-21",
      }),
    );

    const state = loadPlannerState("2026-08-21");
    expect(state).toMatchObject({
      planningMode: "weekly",
      finishByDate: null,
      maxSessionHours: 4,
    });
    expect(state.backlogs[0].group_imports).toEqual([]);
  });

  test("migrates stored games to direct additions without changing their schedule fields", () => {
    window.localStorage.setItem(
      "gaming-clock.planner.v2",
      JSON.stringify({
        activeTab: "games",
        activeBacklogId: "list-a",
        backlogs: [{ id: "list-a", name: "First", games: [resolvedGame] }],
        availability: null,
        algorithm: "sequential",
        schedule: null,
        startDate: "2026-08-21",
      }),
    );

    const state = loadPlannerState("2026-08-21");

    expect(state.backlogs[0].games[0]).toMatchObject({
      ...resolvedGame,
      added_individually: true,
      group_import_ids: [],
      group_keys: [],
    });
  });

  test("keeps the selected list after stored lists are reordered or the old list is removed", () => {
    window.localStorage.setItem(
      "gaming-clock.planner.v2",
      JSON.stringify({
        activeTab: "games",
        activeBacklogId: "list-a",
        backlogs: [
          { id: "list-b", name: "Second", games: [] },
          { id: "list-a", name: "First", games: [] },
        ],
        availability: null,
        algorithm: "sequential",
        schedule: null,
        startDate: "2026-08-21",
      }),
    );

    const reordered = loadPlannerState("2026-08-21");
    expect(reordered.activeBacklogId).toBe("list-a");
    expect(reordered.backlogs.map(({ name }) => name)).toEqual([
      "Second",
      "First",
    ]);

    window.localStorage.setItem(
      "gaming-clock.planner.v2",
      JSON.stringify({
        ...reordered,
        activeBacklogId: "removed-list",
      }),
    );
    const recovered = loadPlannerState("2026-08-21");
    expect(recovered.activeBacklogId).toBe("list-b");
    expect(recovered.backlogs).toHaveLength(2);
  });

  test("falls back to a safe initial state for malformed stored data", () => {
    window.localStorage.setItem(
      "gaming-clock.planner.v2",
      JSON.stringify({
        activeTab: "games",
        activeBacklogId: "missing-list",
        backlogs: [{ id: "", name: "Broken", games: "not-a-list" }],
      }),
    );

    const state = loadPlannerState("2026-08-21", "Fresh Planner");

    expect(state.backlogs).toHaveLength(1);
    expect(state.backlogs[0].name).toBe("Fresh Planner");
    expect(state.activeBacklogId).toBe(state.backlogs[0].id);
  });
});
