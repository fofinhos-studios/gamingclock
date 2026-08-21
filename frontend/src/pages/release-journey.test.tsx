import { render, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { HomePage } from "./home";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function catalogGame(id: number, name: string) {
  return {
    igdb_id: id,
    name,
    cover_url: `https://example.com/${id}.png`,
    summary: `${name} summary`,
    genres: ["RPG"],
    platforms: ["PC"],
    release_year: 2020,
    rating: 90,
  };
}

function resolvedGame(game: ReturnType<typeof catalogGame>) {
  return {
    ...game,
    hltb_status: "resolved",
    hltb_match_name: game.name,
    main_story_hours: game.igdb_id === 7 ? 20 : 30,
    main_extra_hours: game.igdb_id === 7 ? 32 : 45,
    completionist_hours: game.igdb_id === 7 ? 50 : 60,
    selected_hltb_category: "main",
  };
}

const schedule = {
  sessions: [
    {
      game_name: "Final Fantasy VII",
      date: "2026-08-24",
      start_time: "20:00",
      duration_hours: 2,
    },
    {
      game_name: "Chrono Trigger",
      date: "2026-08-25",
      start_time: "20:00",
      duration_hours: 2,
    },
  ],
  total_hours: 4,
  estimated_end_date: "2026-08-25",
};

describe("release journey", () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  test("completes both schedule methods, reloads state, and exports iCal without console errors", async () => {
    const user = userEvent.setup();
    const consoleErrors: unknown[][] = [];
    const originalConsoleError = console.error;
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const firstGame = catalogGame(7, "Final Fantasy VII");
    const secondGame = catalogGame(8, "Chrono Trigger");

    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };
    URL.createObjectURL = () => "blob:gaming-clock";
    URL.revokeObjectURL = () => undefined;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      requests.push({ url, body });

      if (url.startsWith("/api/games/search?")) {
        return jsonResponse([firstGame, secondGame]);
      }
      if (url === "/api/games/resolve") {
        const game = body as typeof firstGame;
        return jsonResponse(resolvedGame(game));
      }
      if (url === "/api/schedule/generate") {
        return jsonResponse(schedule);
      }
      if (url === "/api/schedule/ical") {
        return {
          ok: true,
          blob: async () => new Blob(["BEGIN:VCALENDAR"]),
        } as Response;
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const firstView = render(<HomePage path="/" />);

      await user.click(firstView.getByRole("button", { name: /new backlog/i }));
      const listName = firstView.getByLabelText(/^backlog name$/i);
      await user.clear(listName);
      await user.type(listName, "Weekend rotation");

      const gamesPanel = () => firstView.getByRole("tabpanel");
      const searchInput = within(gamesPanel()).getByRole("textbox", {
        name: /search by title/i,
      });
      await user.type(searchInput, "final");
      await waitFor(() =>
        expect(
          firstView.getByRole("button", {
            name: /add final fantasy vii to backlog/i,
          }),
        ).toBeTruthy(),
      );
      await user.click(
        firstView.getByRole("button", {
          name: /add final fantasy vii to backlog/i,
        }),
      );
      await user.click(
        firstView.getByRole("button", {
          name: /add chrono trigger to backlog/i,
        }),
      );

      await waitFor(() =>
        expect(
          within(gamesPanel()).getAllByRole("button", {
            name: /use completionist time/i,
          }),
        ).toHaveLength(2),
      );
      await user.click(
        within(gamesPanel()).getByRole("button", {
          name: /use completionist time: 50 hours/i,
        }),
      );
      await user.click(
        within(gamesPanel()).getByRole("button", {
          name: /move chrono trigger earlier/i,
        }),
      );

      const listTitles = () =>
        Array.from(
          gamesPanel().querySelectorAll(".planner-backlog-row__title"),
        ).map((title) => title.textContent);
      expect(listTitles()).toEqual(["Chrono Trigger", "Final Fantasy VII"]);

      await user.click(
        firstView.getByRole("tab", { name: /set your routine/i }),
      );
      await user.click(firstView.getByLabelText(/monday/i));
      await user.click(firstView.getByRole("tab", { name: /plan sessions/i }));

      await waitFor(() =>
        expect(
          firstView.container.querySelector("#schedule-heading"),
        ).toBeTruthy(),
      );
      expect(
        requests.filter(({ url }) => url === "/api/schedule/generate"),
      ).toHaveLength(1);
      expect(
        (
          requests.find(({ url }) => url === "/api/schedule/generate")?.body
            .games as Array<Record<string, unknown>>
        )[0].name,
      ).toBe("Chrono Trigger");

      await user.click(
        firstView.getByRole("button", { name: /download \.ics/i }),
      );
      await waitFor(() =>
        expect(
          firstView.getByRole("button", { name: /downloaded/i }),
        ).toBeTruthy(),
      );

      await user.selectOptions(
        firstView.getByLabelText(/schedule method/i),
        "alternating",
      );
      await waitFor(() =>
        expect(
          requests.filter(({ url }) => url === "/api/schedule/generate"),
        ).toHaveLength(2),
      );
      await waitFor(() =>
        expect(
          firstView.container.querySelector("#schedule-heading"),
        ).toBeTruthy(),
      );

      firstView.unmount();
      const reloadedView = render(<HomePage path="/" />);
      expect(reloadedView.getByDisplayValue("Weekend rotation")).toBeTruthy();
      expect(
        reloadedView.getByRole("button", { name: /download \.ics/i }),
      ).toBeTruthy();
      expect(
        (reloadedView.getByLabelText(/schedule method/i) as HTMLSelectElement)
          .value,
      ).toBe("alternating");

      expect(consoleErrors).toEqual([]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
