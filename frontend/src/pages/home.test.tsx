import { fireEvent, render, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import type { CatalogGame, ListGame, ScheduleResponse } from "../types";
import { HomePage } from "./home";

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function createSearchResult(overrides: Partial<ListGame> = {}): ListGame {
  return {
    igdb_id: 10,
    name: "Hollow Knight",
    cover_url: "https://images.igdb.com/igdb/image/upload/t_thumb/test.jpg",
    summary: "Bug souls.",
    genres: ["Action"],
    platforms: ["PC"],
    release_year: 2017,
    rating: 95,
    hltb_status: "resolved",
    hltb_match_name: "Hollow Knight",
    main_story_hours: 27.5,
    main_extra_hours: 40,
    completionist_hours: 60,
    ...overrides,
  };
}

function createCatalogResult(
  overrides: Partial<CatalogGame> = {},
): CatalogGame {
  const {
    hltb_status,
    hltb_match_name,
    main_story_hours,
    main_extra_hours,
    completionist_hours,
    ...catalog
  } = createSearchResult(overrides);
  return catalog;
}

describe("HomePage", () => {
  test("defaults to dark theme and lets the user switch to light theme", async () => {
    const user = userEvent.setup();
    const view = render(<HomePage path="/" />);

    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(
      view.getByRole("button", { name: /switch to light theme/i }),
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("gaming-clock-theme")).toBe("light");

    view.unmount();
    const restoredView = render(<HomePage path="/" />);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      restoredView.getByRole("button", { name: /switch to dark theme/i }),
    ).toBeTruthy();
  });

  test("groups aligned theme, language, and backlog controls at the top right", () => {
    const view = render(<HomePage path="/" />);
    const controls = view.container.querySelector(".planner-toolbar__controls");

    expect(controls).toBeTruthy();
    expect(controls?.querySelector(".toolbar-control")).toBeTruthy();
    expect(view.getByText("Theme")).toBeTruthy();
    expect(controls?.querySelector(".theme-toggle")).toBeTruthy();
    expect(controls?.querySelector(".language-chooser")).toBeTruthy();
    expect(controls?.querySelector(".backlog-manager")).toBeTruthy();
  });

  test("renders an embossed IntraNet wordmark", () => {
    const view = render(<HomePage path="/" />);

    expect(view.getByRole("img", { name: "Gaming Clock" })).toBeTruthy();
    expect(
      view.container.querySelector(".planner-identity__label")?.textContent,
    ).toBe("Gaming Clock");
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(view.container.querySelector(".planner-brand")).toBeNull();
  });

  test("guides people through the planner with a clickable progress stepper", async () => {
    const user = userEvent.setup();
    const view = render(<HomePage path="/" />);

    expect(
      view.getByRole("navigation", {
        name: /plan your game time step by step/i,
      }),
    ).toBeTruthy();
    expect(
      view.getByRole("tab", { name: /build your list.*current step/i }),
    ).toBeTruthy();
    expect(
      view.getByRole("tab", {
        name: /set your routine.*not started/i,
      }),
    ).toBeTruthy();

    await user.click(view.getByRole("tab", { name: /set your routine/i }));

    expect(
      view.getByRole("heading", { name: /when do you play\?/i }),
    ).toBeTruthy();
  });

  test("restores planner work after the page reloads", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const searchResult = createSearchResult();

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult()]);
      }
      if (url === "/api/games/resolve") {
        return createJsonResponse(searchResult);
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const firstView = render(<HomePage path="/" />);
      const gamesPanel = firstView.getByRole("tabpanel");
      const searchInput = within(gamesPanel).getByRole("textbox", {
        name: /search by title/i,
      });

      await user.type(searchInput, "ho");
      await waitFor(() =>
        expect(
          firstView.getByRole("button", {
            name: /add hollow knight to backlog/i,
          }),
        ).toBeTruthy(),
      );
      await user.click(
        firstView.getByRole("button", {
          name: /add hollow knight to backlog/i,
        }),
      );
      await waitFor(() =>
        expect(
          firstView.getByRole("button", {
            name: /use main time: 27\.5 hours/i,
          }),
        ).toBeTruthy(),
      );

      await user.click(
        firstView.getByRole("button", { name: /rename my backlog/i }),
      );
      await user.clear(firstView.getByLabelText(/backlog name/i));
      await user.type(
        firstView.getByLabelText(/backlog name/i),
        "Weekend games",
      );
      await user.click(firstView.getByRole("tab", { name: /availability/i }));
      await user.click(
        firstView.getByRole("button", { name: "Monday at 20:00" }),
      );
      await user.click(firstView.getByRole("tab", { name: /schedule/i }));
      await user.selectOptions(
        firstView.getByLabelText(/schedule method/i),
        "alternating",
      );
      await waitFor(() =>
        expect(
          (firstView.getByLabelText(/schedule method/i) as HTMLSelectElement)
            .value,
        ).toBe("alternating"),
      );

      firstView.unmount();
      const reloadedView = render(<HomePage path="/" />);

      expect(
        reloadedView
          .getByRole("tab", { name: /schedule/i })
          .getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        reloadedView.getByRole("heading", {
          name: "Weekend games",
          hidden: true,
        }),
      ).toBeTruthy();
      await user.click(reloadedView.getByRole("tab", { name: /games/i }));
      expect(
        reloadedView.getByRole("button", {
          name: /use main time: 27\.5 hours/i,
        }),
      ).toBeTruthy();
      await user.click(
        reloadedView.getByRole("tab", { name: /availability/i }),
      );
      expect(
        reloadedView.getByRole("button", {
          name: "Monday, 1h from 20:00",
        }),
      ).toBeTruthy();
      await user.click(reloadedView.getByRole("tab", { name: /schedule/i }));
      expect(
        (reloadedView.getByLabelText(/schedule method/i) as HTMLSelectElement)
          .value,
      ).toBe("alternating");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("adds the selected IGDB game immediately while its playtime resolves", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const catalogResult = createCatalogResult();
    const resolvedResult = createSearchResult();
    const requests: string[] = [];
    let resolvePlaytime: ((response: Response) => void) | undefined;
    const playtimeResponse = new Promise<Response>((resolve) => {
      resolvePlaytime = resolve;
    });

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([catalogResult]);
      }
      if (url === "/api/games/resolve") {
        return playtimeResponse;
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const view = render(<HomePage path="/" />);
      const searchInput = within(view.getByRole("tabpanel")).getByRole(
        "textbox",
        {
          name: /search by title/i,
        },
      );
      await user.type(searchInput, "ho");
      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );
      expect(requests).toHaveLength(1);

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      await waitFor(() => expect(requests).toContain("/api/games/resolve"));
      expect(
        within(view.getByRole("tabpanel")).getByText(/retrieving playtime/i),
      ).toBeTruthy();
      expect(
        within(view.getByRole("tabpanel")).getByText(/^0\.0h$/i),
      ).toBeTruthy();

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByRole("button", { name: "Monday at 20:00" }));
      await user.click(view.getByRole("tab", { name: /schedule/i }));
      expect(
        within(view.getByRole("tabpanel")).getByText(
          /getting playtime estimates/i,
        ),
      ).toBeTruthy();

      resolvePlaytime?.(createJsonResponse(resolvedResult));

      await user.click(view.getByRole("tab", { name: /games/i }));
      await waitFor(() =>
        expect(
          within(view.getByRole("tabpanel")).getByText(/^27\.5h$/i),
        ).toBeTruthy(),
      );
      expect(
        within(view.getByRole("tabpanel")).getByText(/^27\.5h$/i),
      ).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps search results open to add multiple matching games", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const firstGame = createCatalogResult();
    const secondGame = createCatalogResult({
      igdb_id: 11,
      name: "Hollow Knight: Silksong",
    });

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([firstGame, secondGame]);
      }
      if (url === "/api/games/resolve") {
        const game = JSON.parse(String(init?.body ?? "{}")) as CatalogGame;
        return createJsonResponse(
          createSearchResult({
            igdb_id: game.igdb_id,
            name: game.name,
          }),
        );
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
          view.getByRole("button", {
            name: /add hollow knight: silksong to backlog/i,
          }),
        ).toBeTruthy(),
      );

      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );

      expect((searchInput as HTMLInputElement).value).toBe("ho");
      expect(
        view.getByRole("button", {
          name: /add hollow knight: silksong to backlog/i,
        }),
      ).toBeTruthy();

      await user.click(
        view.getByRole("button", {
          name: /add hollow knight: silksong to backlog/i,
        }),
      );

      await waitFor(() =>
        expect(
          activePanel.querySelectorAll(".planner-backlog-row__title"),
        ).toHaveLength(2),
      );
      expect(
        within(activePanel).queryByText(
          /choose a playtime for each game\. select main, main \+ extras, or completionist/i,
        ),
      ).toBeNull();

      await user.click(
        within(activePanel).getAllByRole("button", { name: /^remove$/i })[0],
      );

      expect(
        activePanel.querySelectorAll(".planner-backlog-row__title"),
      ).toHaveLength(1);
      expect(
        activePanel.querySelector(".planner-backlog-row__title")?.textContent,
      ).toBe("Hollow Knight: Silksong");
      expect(
        within(activePanel).getByRole("button", { name: /^remove$/i }),
      ).toBeTruthy();
      expect(within(activePanel).queryByText(/^removed$/i)).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("lets each backlog game activate an HLTB time and removes extra card metadata", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const catalogResult = createCatalogResult();
    const resolvedResult = createSearchResult();
    let scheduleRequest: Record<string, unknown> | null = null;

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([catalogResult]);
      }
      if (url === "/api/games/resolve") {
        return createJsonResponse(resolvedResult);
      }
      if (url === "/api/schedule/generate") {
        scheduleRequest = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        return createJsonResponse({
          sessions: [],
          total_hours: 60,
          estimated_end_date: null,
        });
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
        expect(
          view.getByRole("button", { name: /use main time: 27\.5 hours/i }),
        ).toBeTruthy(),
      );
      expect(
        view.getByText(
          /choose a playtime for each game\. select main, main \+ extras, or completionist/i,
        ),
      ).toBeTruthy();
      expect(
        view
          .getByRole("button", { name: /use main time: 27\.5 hours/i })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(view.queryByText(/playstation/i)).toBeNull();
      expect(view.queryByText(/resolved from/i)).toBeNull();
      expect(within(gamesPanel).getByText(/^27\.5h$/i)).toBeTruthy();

      await user.click(
        view.getByRole("button", {
          name: /use completionist time: 60 hours/i,
        }),
      );
      expect(
        view
          .getByRole("button", {
            name: /use completionist time: 60 hours/i,
          })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(within(gamesPanel).getByText(/^60\.0h$/i)).toBeTruthy();

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByRole("button", { name: "Monday at 20:00" }));
      await user.click(view.getByRole("tab", { name: /schedule/i }));

      await waitFor(() => expect(scheduleRequest).not.toBeNull());
      const requestGames = scheduleRequest?.games as Array<{
        selected_hltb_category?: string;
      }>;
      expect(requestGames[0]?.selected_hltb_category).toBe("completionist");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  test("renders the tabbed planner shell without the removed landing sections", () => {
    const view = render(<HomePage path="/" />);
    const activePanel = view.getByRole("tabpanel");

    expect(view.getByRole("link", { name: /skip to planner/i })).toBeTruthy();
    expect(view.getByRole("main")).toBeTruthy();
    expect(
      view.getByRole("heading", {
        level: 1,
        name: /what do you want to play/i,
      }),
    ).toBeTruthy();
    expect(view.container.querySelector(".backlog-manager")).toBeTruthy();
    expect(view.getByRole("tab", { name: /games/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /availability/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /schedule/i })).toBeTruthy();
    expect(view.queryByText(/gaming backlog planner/i)).toBeNull();
    expect(view.queryByText(/^overview$/i)).toBeNull();
    expect(within(activePanel).getByText(/find your games/i)).toBeTruthy();
    expect(within(activePanel).queryByText(/^search$/i)).toBeNull();
    expect(
      within(activePanel).queryByText(/enter at least 2 characters/i),
    ).toBeNull();
    expect(
      within(activePanel).getByRole("heading", { name: /my backlog/i }),
    ).toBeTruthy();
    expect(within(activePanel).queryByText(/^backlog$/i)).toBeNull();
    expect(within(activePanel).queryByText(/weekly cadence/i)).toBeNull();
    expect(within(activePanel).queryByText(/your schedule/i)).toBeNull();
    expect(
      view.queryByRole("complementary", { name: /planner status/i }),
    ).toBeNull();
  });

  test("switches planner steps manually through the top tabs", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);

    await user.click(view.getByRole("tab", { name: /availability/i }));
    let activePanel = view.getByRole("tabpanel");
    expect(activePanel.id).toBe("planner-panel-availability");
    expect(
      within(activePanel).getByRole("region", { name: /availability/i }),
    ).toBeTruthy();
    expect(within(activePanel).queryByText(/find your games/i)).toBeNull();

    await user.click(view.getByRole("tab", { name: /schedule/i }));
    activePanel = view.getByRole("tabpanel");
    expect(activePanel.id).toBe("planner-panel-schedule");
    expect(
      within(activePanel).getByRole("heading", { name: /date and method/i }),
    ).toBeTruthy();
    expect(within(activePanel).queryByText(/weekly cadence/i)).toBeNull();
    expect(within(activePanel).queryByText(/ready to plan/i)).toBeNull();
    expect(
      within(activePanel).queryByText(/before your schedule can update/i),
    ).toBeNull();
  });

  test("creates a second backlog from the compact backlog manager", async () => {
    const user = userEvent.setup();
    const view = render(<HomePage path="/" />);

    await user.click(view.getByRole("button", { name: /manage backlogs/i }));
    await user.type(view.getByLabelText(/new backlog name/i), "Weekend games");
    await user.click(view.getByRole("button", { name: /create backlog/i }));

    expect(view.getByText("My Backlog")).toBeTruthy();
    expect(
      view.getByRole("button", { name: /weekend games, 0 games/i }),
    ).toBeTruthy();
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

  test("supports horizontal keyboard navigation for the stage tablist", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);
    const gamesTab = view.getByRole("tab", { name: /games/i });
    const availabilityTab = view.getByRole("tab", { name: /availability/i });
    const scheduleTab = view.getByRole("tab", { name: /schedule/i });

    expect(view.getByRole("tablist").getAttribute("aria-orientation")).toBe(
      "horizontal",
    );

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

  test("shows stage actions with prerequisite guidance", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);
    const gamesBack = view.getByRole("button", {
      name: /back to build your list/i,
    });
    const gamesContinue = view.getByRole("button", {
      name: /continue to set your routine/i,
    });

    expect(gamesBack.getAttribute("title")).toMatch(/first step/i);
    expect(gamesContinue.hasAttribute("disabled")).toBe(true);
    expect(gamesContinue.getAttribute("title")).toMatch(
      /add and resolve at least one game before continuing/i,
    );
    expect(view.getByText(/you are at the first step/i)).toBeTruthy();

    await user.click(view.getByRole("tab", { name: /availability/i }));

    const availabilityContinue = view.getByRole("button", {
      name: /continue to plan sessions/i,
    });
    expect(
      view.getByRole("button", { name: /back to build your list/i }),
    ).toBeTruthy();
    expect(availabilityContinue.hasAttribute("disabled")).toBe(true);
    expect(availabilityContinue.getAttribute("title")).toMatch(
      /set your weekly play time before continuing/i,
    );

    await user.click(view.getByRole("tab", { name: /schedule/i }));
    const finalContinue = view.getByRole("button", { name: /^continue$/i });
    expect(finalContinue.hasAttribute("disabled")).toBe(true);
    expect(finalContinue.getAttribute("title")).toMatch(/final step/i);
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

  test("shows loading copy while searching games", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        return createJsonResponse([]);
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;

    try {
      const view = render(<HomePage path="/" />);
      const activePanel = view.getByRole("tabpanel");
      const searchInput = within(activePanel).getByRole("textbox", {
        name: /search by title/i,
      });

      await user.type(searchInput, "ha");

      await waitFor(() =>
        expect(view.getByText(/finding games/i)).toBeTruthy(),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("sends the selected weekly start time when the live schedule updates", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    let scheduleRequest: Record<string, unknown> | null = null;

    const searchResult = createSearchResult();

    const schedule: ScheduleResponse = {
      sessions: [
        {
          game_name: "Hollow Knight",
          date: "2026-03-30",
          start_time: "18:30:00",
          duration_hours: 2.5,
        },
      ],
      total_hours: 2.5,
      estimated_end_date: "2026-03-30",
    };

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult()]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(searchResult);
      }

      if (url === "/api/schedule/generate") {
        scheduleRequest = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
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
        expect(
          view.getByRole("button", { name: /use main time: 27\.5 hours/i }),
        ).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));

      const availabilityPanel = view.getByRole("tabpanel");
      await user.click(
        within(availabilityPanel).getByRole("button", {
          name: "Monday at 18:30",
        }),
      );
      await user.click(
        within(availabilityPanel).getByRole("button", {
          name: "Monday, 1h from 18:30",
        }),
      );
      await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      await waitFor(() => expect(scheduleRequest).not.toBeNull());

      const requestAvailability = scheduleRequest?.availability as {
        days: Array<{
          day_of_week: number;
          hours: number;
          start_hour: number;
          start_minute: number;
        }>;
      };

      expect(requestAvailability.days).toEqual([
        {
          day_of_week: 0,
          hours: 2,
          start_hour: 18,
          start_minute: 30,
        },
      ]);
      expect(
        within(view.getByRole("tabpanel")).getByText(/^18:30$/),
      ).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("shows only the current-list hours and missing schedule prerequisites", async () => {
    const user = userEvent.setup();
    const view = render(<HomePage path="/" />);

    expect(
      view.queryByRole("complementary", { name: /planner status/i }),
    ).toBeNull();
    expect(
      within(view.getByRole("tabpanel")).getByText(/^0\.0h$/i),
    ).toBeTruthy();
    expect(view.queryByText(/availability status/i)).toBeNull();

    await user.click(view.getByRole("tab", { name: /schedule/i }));

    const activePanel = view.getByRole("tabpanel");
    expect(
      within(activePanel).getByText(/add at least one game to the backlog/i),
    ).toBeTruthy();
    expect(
      within(activePanel).getByText(/set your weekly availability/i),
    ).toBeTruthy();
  });

  test("schedules available games while naming games without HLTB playtime", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    let scheduleGenerated = false;

    const unresolvedGame = createSearchResult({
      hltb_status: "unresolved",
      hltb_match_name: null,
      main_story_hours: null,
      main_extra_hours: null,
      completionist_hours: null,
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult()]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(unresolvedGame);
      }

      if (url === "/api/schedule/generate") {
        scheduleGenerated = true;
        return createJsonResponse({
          sessions: [],
          total_hours: 0,
          estimated_end_date: null,
        });
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
        expect(
          within(activePanel).getByText(/playtime unavailable/i),
        ).toBeTruthy(),
      );
      expect(
        activePanel.querySelector(".planner-backlog-row__title")?.textContent,
      ).toBe("Hollow Knight");

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByRole("button", { name: "Monday at 20:00" }));
      await user.click(view.getByRole("tab", { name: /schedule/i }));

      await waitFor(() => expect(scheduleGenerated).toBe(true));
      expect(
        within(view.getByRole("tabpanel")).getByText(
          /hollow knight does not have hltb playtime data/i,
        ),
      ).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("retries only HLTB fields without replacing saved card artwork", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    let resolveAttempt = 0;
    const unresolvedGame = createSearchResult({
      hltb_status: "unresolved",
      hltb_match_name: null,
      main_story_hours: null,
      main_extra_hours: null,
      completionist_hours: null,
    });
    const retryResult = createSearchResult({
      cover_url: "https://example.com/retried-cover.jpg",
      logo_url: "https://example.com/retried-logo.png",
      hero_url: "https://example.com/retried-hero.jpg",
      main_story_hours: 42,
      main_extra_hours: 60,
      completionist_hours: 80,
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult()]);
      }
      if (url === "/api/games/resolve") {
        resolveAttempt += 1;
        return createJsonResponse(
          resolveAttempt === 1 ? unresolvedGame : retryResult,
        );
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
        expect(
          within(gamesPanel).getByRole("button", {
            name: /retry hollow knight playtime/i,
          }),
        ).toBeTruthy(),
      );

      const originalCoverUrl = view.container
        .querySelector(".planner-backlog-row .game-cartridge__cover")
        ?.getAttribute("src");

      await user.click(
        within(gamesPanel).getByRole("button", {
          name: /retry hollow knight playtime/i,
        }),
      );

      await waitFor(() =>
        expect(within(gamesPanel).getByText(/42h main/i)).toBeTruthy(),
      );
      expect(
        view.container
          .querySelector(".planner-backlog-row .game-cartridge__cover")
          ?.getAttribute("src"),
      ).toBe(originalCoverUrl);
      expect(resolveAttempt).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps duplicate add feedback stable without key warnings", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const consoleErrors: unknown[][] = [];

    const searchResult = createSearchResult();

    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult()]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(searchResult);
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
        expect(view.getByRole("heading", { name: /my backlog/i })).toBeTruthy(),
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

      expect(view.getAllByText(/hollow knight/i).length).toBeGreaterThan(0);
      expect(view.getByRole("heading", { name: /my backlog/i })).toBeTruthy();
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

    const searchResult = createSearchResult();

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
        return createJsonResponse([createCatalogResult()]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(searchResult);
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
        expect(
          view.getByRole("button", { name: /use main time: 27\.5 hours/i }),
        ).toBeTruthy(),
      );

      await waitFor(() =>
        expect(view.getByRole("heading", { name: /my backlog/i })).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByRole("button", { name: "Monday at 20:00" }));

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      await waitFor(() =>
        expect(view.container.querySelector("#schedule-heading")).toBeTruthy(),
      );

      const schedulePanel = view.getByRole("tabpanel");
      expect(
        within(schedulePanel).getByText(/total planned hours/i),
      ).toBeTruthy();
      expect(within(schedulePanel).getByText(/estimated finish/i)).toBeTruthy();
      const sessionsMetric = within(schedulePanel)
        .getByText(/^sessions$/i)
        .closest(".planner-metric");
      expect(sessionsMetric).toBeTruthy();
      if (!sessionsMetric) {
        throw new Error("Sessions metric is missing its metric container");
      }
      expect(within(schedulePanel).getByText(/days to finish/i)).toBeTruthy();
      expect(within(sessionsMetric).getByText(/^2$/)).toBeTruthy();
      expect(within(schedulePanel).getByText(/3 days/i)).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps the schedule current when start date or algorithm changes", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;

    const searchResult = createSearchResult();

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
        return createJsonResponse([createCatalogResult()]);
      }

      if (url === "/api/games/resolve") {
        return createJsonResponse(searchResult);
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
        expect(
          view.getByRole("button", { name: /use main time: 27\.5 hours/i }),
        ).toBeTruthy(),
      );

      await waitFor(() =>
        expect(view.getByRole("heading", { name: /my backlog/i })).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByRole("button", { name: "Monday at 20:00" }));

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      const schedulePanel = () => view.getByRole("tabpanel");
      await waitFor(() =>
        expect(view.container.querySelector("#schedule-heading")).toBeTruthy(),
      );

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
        expect(view.container.querySelector("#schedule-heading")).toBeTruthy(),
      );

      await user.selectOptions(
        within(schedulePanel()).getByLabelText(/schedule method/i),
        "alternating",
      );

      await waitFor(() =>
        expect(view.container.querySelector("#schedule-heading")).toBeTruthy(),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
