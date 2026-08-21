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

  test("keeps unresolved game details from schedule responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        detail: {
          message: "Cannot generate schedule with unresolved games",
          unresolved_games: [{ igdb_id: 7, name: "Final Fantasy VII" }],
        },
      }),
    }) as typeof fetch;

    const error = await generateSchedule(
      "Weekend RPGs",
      [listGame],
      availability,
      "sequential",
      "2026-08-22",
    ).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "Cannot generate schedule with unresolved games",
      operation: "schedule",
      unresolvedGames: [{ igdb_id: 7, name: "Final Fantasy VII" }],
    });
    expect(getApiErrorMessage(error, "fallback")).toContain(
      "Final Fantasy VII",
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
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      game_list_name: "Weekend RPGs",
      algorithm: "alternating",
      start_date: "2026-08-22",
      games: [
        { igdb_id: 7, selected_hltb_category: "completionist" },
        { igdb_id: 8, name: "Chrono Trigger" },
      ],
    });
  });
});
