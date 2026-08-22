import { afterEach, describe, expect, test, vi } from "vitest";

import type { CatalogGame, ListGame, WeeklyAvailability } from "../types";
import {
  ApiError,
  generateSchedule,
  getApiErrorMessage,
  resolveGame,
} from "./api";

const originalFetch = globalThis.fetch;
const catalogGame: CatalogGame = {
  igdb_id: 7,
  name: "Final Fantasy VII",
  cover_url: "https://example.com/ff7.png",
  summary: "Classic RPG",
  genres: ["RPG"],
  platforms: ["PlayStation"],
  release_year: 1997,
  rating: 95,
};
const listGame: ListGame = {
  ...catalogGame,
  hltb_status: "resolved",
  hltb_match_name: "Final Fantasy VII",
  main_story_hours: 36,
  main_extra_hours: 52,
  completionist_hours: 80,
  selected_hltb_category: "completionist",
};
const availability: WeeklyAvailability = {
  days: [{ day_of_week: 6, hours: 3, start_hour: 10 }],
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("api client errors and contracts", () => {
  test("preserves backend resolution errors as typed actionable errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: "HLTB service is unavailable" }),
    }) as typeof fetch;

    const error = await resolveGame(catalogGame).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "HLTB service is unavailable",
      status: 503,
      kind: "backend",
      operation: "resolve",
    });
    expect(getApiErrorMessage(error, "fallback")).toBe(
      "HLTB service is unavailable",
    );
  });

  test("wraps network failures with the operation and fallback message", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch")) as typeof fetch;

    const error = await resolveGame(catalogGame).catch(
      (value: unknown) => value,
    );

    expect(error).toMatchObject({
      message: "Could not find a playtime estimate",
      kind: "network",
      operation: "resolve",
    });
  });

  test("serializes queue order and selected duration in schedule requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: [],
        total_hours: 0,
        estimated_end_date: null,
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await generateSchedule(
      "Weekend RPGs",
      [listGame, { ...listGame, igdb_id: 8, name: "Chrono Trigger" }],
      availability,
      "alternating",
      "2026-08-22",
      "finish_by",
      "2026-09-30",
      4,
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      game_list_name: "Weekend RPGs",
      algorithm: "alternating",
      start_date: "2026-08-22",
      planning_mode: "finish_by",
      finish_by_date: "2026-09-30",
      max_session_hours: 4,
      games: [
        { igdb_id: 7, selected_hltb_category: "completionist" },
        { igdb_id: 8, name: "Chrono Trigger" },
      ],
    });
  });
});
