import { afterEach, describe, expect, test, vi } from "vitest";

import type { CatalogGame, ListGame, WeeklyAvailability } from "../types";
import {
  ApiError,
  createCalendarUrl,
  generateSchedule,
  getApiErrorMessage,
  getGameArtwork,
  resolveGame,
  searchGames,
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
  vi.unstubAllGlobals();
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

  test("uses a cacheable GET URL for game artwork", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cover_url: "", logo_url: "", hero_url: "" }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await getGameArtwork(catalogGame);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/games/artwork?igdb_id=7&name=Final+Fantasy+VII",
      {},
    );
  });

  test("reuses recent search and resolved-game responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [catalogGame],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => listGame,
      });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(searchGames("Final Fantasy VII")).resolves.toEqual([
      catalogGame,
    ]);
    await expect(searchGames("final fantasy vii")).resolves.toEqual([
      catalogGame,
    ]);
    await expect(resolveGame(catalogGame)).resolves.toEqual(listGame);
    await expect(resolveGame(catalogGame)).resolves.toEqual(listGame);

    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  test("creates an absolute calendar URL that preserves edited sessions", async () => {
    vi.stubGlobal("CompressionStream", undefined);

    const url = await createCalendarUrl("Weekend RPGs", [
      {
        game_name: "Final Fantasy VII",
        date: "2026-08-22",
        start_time: "20:00",
        duration_hours: 2,
      },
    ]);

    const parsed = new URL(url);
    expect(parsed.origin).toBe("http://localhost");
    expect(parsed.pathname).toBe("/api/schedule/ical-url");
    expect(parsed.searchParams.get("encoding")).toBe("plain");
    const payload = parsed.searchParams.get("payload");
    expect(
      JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(payload as string), (character) =>
            character.charCodeAt(0),
          ),
        ),
      ),
    ).toMatchObject({
      game_list_name: "Weekend RPGs",
      sessions: [{ game_name: "Final Fantasy VII", date: "2026-08-22" }],
    });
  });
});
