import { describe, expect, test } from "bun:test";
import { render, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";

import type { CatalogGame, ListGame, ScheduleResponse } from "../types";
import { HomePage } from "./home";

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

describe("HomePage", () => {
  test("renders the tabbed planner shell without the removed landing sections", () => {
    const view = render(<HomePage path="/" />);
    const activePanel = view.getByRole("tabpanel");

    expect(view.getByRole("link", { name: /skip to planner/i })).toBeTruthy();
    expect(view.getByRole("main")).toBeTruthy();
    expect(view.getByText(/gaming clock/i)).toBeTruthy();
    expect(
      view.getByRole("heading", { level: 1, name: /build backlog/i }),
    ).toBeTruthy();
    expect(view.getByRole("tab", { name: /games/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /availability/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /schedule/i })).toBeTruthy();
    expect(view.queryByText(/gaming backlog planner/i)).toBeNull();
    expect(view.queryByText(/^overview$/i)).toBeNull();
    expect(within(activePanel).getByText(/find games/i)).toBeTruthy();
    expect(within(activePanel).queryByText(/weekly cadence/i)).toBeNull();
    expect(within(activePanel).queryByText(/generated schedule/i)).toBeNull();
    expect(
      view.getByRole("complementary", { name: /planner status/i }),
    ).toBeTruthy();
  });

  test("switches planner steps manually through the top tabs", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);

    await user.click(view.getByRole("tab", { name: /availability/i }));
    let activePanel = view.getByRole("tabpanel");
    expect(activePanel.id).toBe("planner-panel-availability");
    expect(within(activePanel).getByText(/weekly cadence/i)).toBeTruthy();
    expect(within(activePanel).queryByText(/find games/i)).toBeNull();

    await user.click(view.getByRole("tab", { name: /schedule/i }));
    activePanel = view.getByRole("tabpanel");
    expect(activePanel.id).toBe("planner-panel-schedule");
    expect(
      within(activePanel).getByRole("button", { name: /generate schedule/i }),
    ).toBeTruthy();
    expect(within(activePanel).queryByText(/weekly cadence/i)).toBeNull();
    expect(within(activePanel).queryByText(/ready to plan/i)).toBeNull();
    expect(within(activePanel).getByText(/before you generate/i)).toBeTruthy();
  });

  test("preserves step-local draft state when switching tabs", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);
    let activePanel = view.getByRole("tabpanel");

    const searchInput = within(activePanel).getByRole("textbox", {
      name: /search by title/i,
    });
    await user.type(searchInput, "z");
    expect((searchInput as HTMLInputElement).value).toBe("z");

    await user.click(view.getByRole("tab", { name: /availability/i }));
    await user.click(view.getByRole("tab", { name: /games/i }));

    activePanel = view.getByRole("tabpanel");
    const restoredSearchInput = within(activePanel).getByRole("textbox", {
      name: /search by title/i,
    });
    expect((restoredSearchInput as HTMLInputElement).value).toBe("z");
  });

  test("supports horizontal keyboard navigation for the tablist", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);
    const gamesTab = view.getByRole("tab", { name: /games/i });
    const availabilityTab = view.getByRole("tab", { name: /availability/i });
    const scheduleTab = view.getByRole("tab", { name: /schedule/i });

    expect(gamesTab.getAttribute("tabindex")).toBe("0");
    expect(availabilityTab.getAttribute("tabindex")).toBe("-1");
    expect(scheduleTab.getAttribute("tabindex")).toBe("-1");

    gamesTab.focus();
    expect(document.activeElement).toBe(gamesTab);

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(availabilityTab);
    expect(availabilityTab.getAttribute("aria-selected")).toBe("true");
    expect(availabilityTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-availability");

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(scheduleTab);
    expect(scheduleTab.getAttribute("aria-selected")).toBe("true");
    expect(scheduleTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-schedule");

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(gamesTab);
    expect(gamesTab.getAttribute("aria-selected")).toBe("true");
    expect(gamesTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-games");

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(scheduleTab);
    expect(scheduleTab.getAttribute("aria-selected")).toBe("true");
    expect(scheduleTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-schedule");
  });

  test("initializes start date from the local calendar day instead of UTC ISO date", async () => {
    const user = userEvent.setup();
    const RealDate = globalThis.Date;

    class MockDate extends RealDate {
      constructor(value?: string | number | Date) {
        super(value ?? "2026-03-29T01:30:00.000Z");
      }

      getFullYear() {
        return 2026;
      }

      getMonth() {
        return 2;
      }

      getDate() {
        return 28;
      }

      toISOString() {
        return "2026-03-29T01:30:00.000Z";
      }

      static now() {
        return new RealDate("2026-03-29T01:30:00.000Z").valueOf();
      }
    }

    globalThis.Date = MockDate as unknown as DateConstructor;

    try {
      const view = render(<HomePage path="/" />);

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      expect(
        (
          within(view.getByRole("tabpanel")).getByLabelText(
            /start date/i,
          ) as HTMLInputElement
        ).value,
      ).toBe("2026-03-28");
    } finally {
      globalThis.Date = RealDate;
    }
  });

  test("shows planner summary status and missing schedule prerequisites", async () => {
    const user = userEvent.setup();
    const view = render(<HomePage path="/" />);
    const summaryPanel = view.getByRole("complementary", {
      name: /planner status/i,
    });

    expect(summaryPanel).toBeTruthy();
    expect(within(summaryPanel).getByText(/^games$/i)).toBeTruthy();
    expect(within(summaryPanel).getByText(/resolved hours/i)).toBeTruthy();
    expect(within(summaryPanel).getByText(/availability status/i)).toBeTruthy();

    await user.click(view.getByRole("tab", { name: /schedule/i }));

    const activePanel = view.getByRole("tabpanel");
    const generateButton = within(activePanel).getByRole("button", {
      name: /generate schedule/i,
    });
    const prerequisiteDescriptionId =
      generateButton.getAttribute("aria-describedby");

    expect(generateButton.hasAttribute("disabled")).toBe(true);
    expect(prerequisiteDescriptionId).toBeTruthy();
    expect(
      within(activePanel).getByText(/add at least one game to the backlog/i),
    ).toBeTruthy();
    expect(
      within(activePanel).getByText(/set your weekly availability/i),
    ).toBeTruthy();
    expect(
      activePanel.querySelector(`#${prerequisiteDescriptionId ?? ""}`)
        ?.textContent,
    ).toMatch(/add at least one game to the backlog/i);
  });

  test("explains unresolved backlog entries before schedule generation", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;

    const searchResult: CatalogGame = {
      igdb_id: 10,
      name: "Hollow Knight",
      cover_url: "https://images.igdb.com/igdb/image/upload/t_thumb/test.jpg",
      summary: "Bug souls.",
      genres: ["Action"],
      platforms: ["PC"],
      release_year: 2017,
      rating: 95,
    };

    const unresolvedGame: ListGame = {
      ...searchResult,
      hltb_status: "unresolved",
      hltb_match_name: null,
      main_story_hours: null,
      main_extra_hours: null,
      completionist_hours: null,
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([searchResult]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(unresolvedGame);
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const view = render(<HomePage path="/" />);
      const activePanel = view.getByRole("tabpanel");
      const searchInput = within(activePanel).getByRole("textbox", {
        name: /search by title/i,
      });

      await user.type(searchInput, "ho");

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      await waitFor(() =>
        expect(view.getByDisplayValue(/my backlog/i)).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      const schedulePanel = view.getByRole("tabpanel");
      expect(
        within(schedulePanel).getByText(/resolve hltb time for hollow knight/i),
      ).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("renders duplicate unresolved prerequisite entries without duplicate key warnings", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const consoleErrors: unknown[][] = [];

    const searchResult: CatalogGame = {
      igdb_id: 10,
      name: "Hollow Knight",
      cover_url: "https://images.igdb.com/igdb/image/upload/t_thumb/test.jpg",
      summary: "Bug souls.",
      genres: ["Action"],
      platforms: ["PC"],
      release_year: 2017,
      rating: 95,
    };

    const unresolvedGame: ListGame = {
      ...searchResult,
      hltb_status: "unresolved",
      hltb_match_name: null,
      main_story_hours: null,
      main_extra_hours: null,
      completionist_hours: null,
    };

    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([searchResult]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(unresolvedGame);
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const view = render(<HomePage path="/" />);
      const gamesPanel = view.getByRole("tabpanel");
      const searchInput = within(gamesPanel).getByRole("textbox", {
        name: /search by title/i,
      });

      await user.type(searchInput, "ho");

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      await waitFor(() =>
        expect(view.getAllByDisplayValue(/my backlog/i).length).toBe(1),
      );

      await user.type(searchInput, "ho");

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      const schedulePanel = view.getByRole("tabpanel");
      expect(
        within(schedulePanel).getAllByText(
          /resolve hltb time for hollow knight/i,
        ),
      ).toHaveLength(2);
      expect(
        consoleErrors.some((args) =>
          args.some((arg) => String(arg).toLowerCase().includes("key")),
        ),
      ).toBe(false);
    } finally {
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });

  test("renders schedule metrics on the home page after generating a schedule", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;

    const searchResult: CatalogGame = {
      igdb_id: 10,
      name: "Hollow Knight",
      cover_url: "https://images.igdb.com/igdb/image/upload/t_thumb/test.jpg",
      summary: "Bug souls.",
      genres: ["Action"],
      platforms: ["PC"],
      release_year: 2017,
      rating: 95,
    };

    const resolvedGame: ListGame = {
      ...searchResult,
      hltb_status: "resolved",
      hltb_match_name: "Hollow Knight",
      main_story_hours: 27.5,
      main_extra_hours: 40,
      completionist_hours: 60,
    };

    const schedule: ScheduleResponse = {
      sessions: [
        {
          game_name: "Hollow Knight",
          date: "2026-03-30",
          start_time: "20:00",
          duration_hours: 2.5,
        },
        {
          game_name: "Hollow Knight",
          date: "2026-04-01",
          start_time: "20:00",
          duration_hours: 2,
        },
      ],
      total_hours: 4.5,
      estimated_end_date: "2026-04-03",
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([searchResult]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(resolvedGame);
      }

      if (url === "/api/schedule/generate") {
        return createJsonResponse(schedule);
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const view = render(<HomePage path="/" />);
      const gamesPanel = view.getByRole("tabpanel");
      const searchInput = within(gamesPanel).getByRole("textbox", {
        name: /search by title/i,
      });

      await user.type(searchInput, "ho");

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      await waitFor(() =>
        expect(view.getByDisplayValue(/my backlog/i)).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByLabelText(/monday/i));
      await user.click(
        view.getByRole("button", { name: /save availability/i }),
      );

      await user.click(view.getByRole("tab", { name: /schedule/i }));
      await user.click(
        view.getByRole("button", { name: /generate schedule/i }),
      );

      await waitFor(() =>
        expect(
          within(view.getByRole("tabpanel")).getByRole("heading", {
            level: 2,
            name: /generated schedule/i,
          }),
        ).toBeTruthy(),
      );

      const schedulePanel = view.getByRole("tabpanel");
      const summaryPanel = view.getByRole("complementary", {
        name: /planner status/i,
      });
      expect(
        within(schedulePanel).getByText(/total planned hours/i),
      ).toBeTruthy();
      expect(within(schedulePanel).getByText(/estimated finish/i)).toBeTruthy();
      expect(within(schedulePanel).getByText(/^sessions$/i)).toBeTruthy();
      expect(
        within(schedulePanel).getByText(/total elapsed days/i),
      ).toBeTruthy();
      expect(within(schedulePanel).getByText(/^2$/)).toBeTruthy();
      expect(within(schedulePanel).getByText(/3 days/i)).toBeTruthy();
      expect(within(summaryPanel).getByText(/elapsed days/i)).toBeTruthy();
      expect(within(summaryPanel).getByText(/3 days/i)).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("invalidates a generated schedule when start date or algorithm changes", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;

    const searchResult: CatalogGame = {
      igdb_id: 10,
      name: "Hollow Knight",
      cover_url: "https://images.igdb.com/igdb/image/upload/t_thumb/test.jpg",
      summary: "Bug souls.",
      genres: ["Action"],
      platforms: ["PC"],
      release_year: 2017,
      rating: 95,
    };

    const resolvedGame: ListGame = {
      ...searchResult,
      hltb_status: "resolved",
      hltb_match_name: "Hollow Knight",
      main_story_hours: 27.5,
      main_extra_hours: 40,
      completionist_hours: 60,
    };

    const schedule: ScheduleResponse = {
      sessions: [
        {
          game_name: "Hollow Knight",
          date: "2026-03-30",
          start_time: "20:00",
          duration_hours: 2.5,
        },
        {
          game_name: "Hollow Knight",
          date: "2026-04-01",
          start_time: "20:00",
          duration_hours: 2,
        },
      ],
      total_hours: 4.5,
      estimated_end_date: "2026-04-03",
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([searchResult]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(resolvedGame);
      }

      if (url === "/api/schedule/generate") {
        return createJsonResponse(schedule);
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const view = render(<HomePage path="/" />);
      const gamesPanel = view.getByRole("tabpanel");
      const searchInput = within(gamesPanel).getByRole("textbox", {
        name: /search by title/i,
      });

      await user.type(searchInput, "ho");

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      await waitFor(() =>
        expect(view.getByDisplayValue(/my backlog/i)).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByLabelText(/monday/i));
      await user.click(
        view.getByRole("button", { name: /save availability/i }),
      );

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      const schedulePanel = () => view.getByRole("tabpanel");
      const generateSchedule = async () => {
        await user.click(
          within(schedulePanel()).getByRole("button", {
            name: /generate schedule/i,
          }),
        );

        await waitFor(() =>
          expect(
            within(schedulePanel()).getByRole("heading", {
              level: 2,
              name: /generated schedule/i,
            }),
          ).toBeTruthy(),
        );
      };

      await generateSchedule();

      await user.clear(
        within(schedulePanel()).getByLabelText(
          /start date/i,
        ) as HTMLInputElement,
      );
      await user.type(
        within(schedulePanel()).getByLabelText(/start date/i),
        "2026-04-05",
      );

      await waitFor(() =>
        expect(
          within(schedulePanel()).queryByRole("heading", {
            level: 2,
            name: /generated schedule/i,
          }),
        ).toBeNull(),
      );
      expect(
        within(schedulePanel()).queryByRole("button", {
          name: /download \.ics/i,
        }),
      ).toBeNull();

      await generateSchedule();

      await user.selectOptions(
        within(schedulePanel()).getByLabelText(/algorithm/i),
        "alternating",
      );

      await waitFor(() =>
        expect(
          within(schedulePanel()).queryByRole("heading", {
            level: 2,
            name: /generated schedule/i,
          }),
        ).toBeNull(),
      );
      expect(
        within(schedulePanel()).queryByRole("button", {
          name: /download \.ics/i,
        }),
      ).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
