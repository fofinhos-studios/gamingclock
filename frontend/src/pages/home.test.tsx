import { render, waitFor, within } from "@testing-library/preact";
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

  test("groups theme and language controls at the top right", () => {
    const view = render(<HomePage path="/" />);
    const controls = view.container.querySelector(".planner-toolbar__controls");

    expect(controls).toBeTruthy();
    expect(controls?.querySelector(".theme-toggle")).toBeTruthy();
    expect(controls?.querySelector(".language-chooser")).toBeTruthy();
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
      view.getByRole("tab", { name: /add games.*current step/i }),
    ).toBeTruthy();
    expect(
      view.getByRole("tab", {
        name: /set weekly play time.*not started/i,
      }),
    ).toBeTruthy();

    await user.click(view.getByRole("tab", { name: /set weekly play time/i }));

    expect(
      view.getByRole("heading", { name: /set your weekly play time/i }),
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

      await user.clear(firstView.getByDisplayValue("My Backlog"));
      await user.type(firstView.getByDisplayValue(""), "Weekend games");
      await user.click(firstView.getByRole("tab", { name: /availability/i }));
      await user.click(firstView.getByLabelText(/monday/i));
      await user.click(
        firstView.getByRole("button", { name: /save play time/i }),
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
      expect(reloadedView.getByDisplayValue("Weekend games")).toBeTruthy();
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
        (reloadedView.getByLabelText(/monday/i) as HTMLInputElement).checked,
      ).toBe(true);
      await user.click(reloadedView.getByRole("tab", { name: /schedule/i }));
      expect(
        (reloadedView.getByLabelText(/schedule method/i) as HTMLSelectElement)
          .value,
      ).toBe("alternating");
      expect(
        reloadedView
          .getByRole("button", { name: /generate schedule/i })
          .hasAttribute("disabled"),
      ).toBe(false);
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
      await user.click(view.getByLabelText(/monday/i));
      await user.click(view.getByRole("button", { name: /save play time/i }));
      await user.click(view.getByRole("tab", { name: /schedule/i }));

      const generateButton = within(view.getByRole("tabpanel")).getByRole(
        "button",
        { name: /generate schedule/i },
      );
      expect(generateButton.hasAttribute("disabled")).toBe(true);
      expect(
        within(view.getByRole("tabpanel")).getByText(
          /getting playtime estimates/i,
        ),
      ).toBeTruthy();

      resolvePlaytime?.(createJsonResponse(resolvedResult));

      await waitFor(() =>
        expect(generateButton.hasAttribute("disabled")).toBe(false),
      );
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
      await user.click(view.getByLabelText(/monday/i));
      await user.click(view.getByRole("button", { name: /save play time/i }));
      await user.click(view.getByRole("tab", { name: /schedule/i }));
      await user.click(
        within(view.getByRole("tabpanel")).getByRole("button", {
          name: /generate schedule/i,
        }),
      );

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
    expect(view.getByText(/gaming clock/i)).toBeTruthy();
    expect(
      view.getByRole("heading", { level: 1, name: /add games/i }),
    ).toBeTruthy();
    expect(
      view
        .getByLabelText(/backlogs/i)
        .classList.contains("planner-toolbar__backlogs"),
    ).toBe(true);
    expect(view.getByRole("tab", { name: /games/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /availability/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /schedule/i })).toBeTruthy();
    expect(view.queryByText(/gaming backlog planner/i)).toBeNull();
    expect(view.queryByText(/^overview$/i)).toBeNull();
    expect(within(activePanel).getByText(/find games/i)).toBeTruthy();
    expect(within(activePanel).queryByText(/^search$/i)).toBeNull();
    expect(
      within(activePanel).queryByText(/enter at least 2 characters/i),
    ).toBeNull();
    expect(within(activePanel).getByText(/current list/i)).toBeTruthy();
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
    expect(within(activePanel).getByText(/weekly play time/i)).toBeTruthy();
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

  test("creates a second backlog and switches between backlogs", async () => {
    const user = userEvent.setup();
    const view = render(<HomePage path="/" />);

    await user.click(view.getByRole("button", { name: /new backlog/i }));

    expect(view.getByRole("button", { name: /my backlog/i })).toBeTruthy();
    expect(view.getByRole("button", { name: /backlog 2/i })).toBeTruthy();
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
      name: /back to add games/i,
    });
    const gamesContinue = view.getByRole("button", {
      name: /continue to set weekly play time/i,
    });

    expect(gamesBack.getAttribute("aria-describedby")).toBeTruthy();
    expect(gamesContinue.hasAttribute("disabled")).toBe(true);
    expect(gamesContinue.getAttribute("aria-describedby")).toBeTruthy();
    expect(view.getByText(/you are at the first step/i)).toBeTruthy();
    expect(
      view.getByText(/add and resolve at least one game before continuing/i),
    ).toBeTruthy();

    await user.click(view.getByRole("tab", { name: /availability/i }));

    const availabilityContinue = view.getByRole("button", {
      name: /continue to create your schedule/i,
    });
    expect(
      view.getByRole("button", { name: /back to add games/i }),
    ).toBeTruthy();
    expect(availabilityContinue.hasAttribute("disabled")).toBe(true);
    expect(
      view.getByText(/save your weekly play time before continuing/i),
    ).toBeTruthy();

    await user.click(view.getByRole("tab", { name: /schedule/i }));
    const finalContinue = view.getByRole("button", { name: /^continue$/i });
    expect(finalContinue.hasAttribute("disabled")).toBe(true);
    expect(view.getByText(/this is the final step/i)).toBeTruthy();
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

  test("saves the selected weekly start hour and sends it when generating a schedule", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    let scheduleRequest: Record<string, unknown> | null = null;

    const searchResult = createSearchResult();

    const schedule: ScheduleResponse = {
      sessions: [
        {
          game_name: "Hollow Knight",
          date: "2026-03-30",
          start_time: "18:00:00",
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
      await user.click(within(availabilityPanel).getByLabelText(/monday/i));
      await user.click(within(availabilityPanel).getByLabelText(/^Start time/));
      await user.clear(within(availabilityPanel).getByLabelText(/^Start time/));
      await user.type(
        within(availabilityPanel).getByLabelText(/^Start time/),
        "18:00",
      );
      await user.click(
        within(availabilityPanel).getByRole("button", {
          name: /save play time/i,
        }),
      );

      await user.click(view.getByRole("tab", { name: /schedule/i }));
      await user.click(
        within(view.getByRole("tabpanel")).getByRole("button", {
          name: /generate schedule/i,
        }),
      );

      await waitFor(() => expect(scheduleRequest).not.toBeNull());

      const requestAvailability = scheduleRequest?.availability as {
        days: Array<{ day_of_week: number; hours: number; start_hour: number }>;
      };

      expect(requestAvailability.days).toEqual([
        {
          day_of_week: 0,
          hours: 2,
          start_hour: 18,
        },
      ]);
      expect(
        within(view.getByRole("tabpanel")).getByText(/at 18:00:00/i),
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

  test("keeps a game in the list when its HLTB playtime is unavailable", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;

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
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("offers a retry when a game's playtime is unavailable", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    let resolveAttempts = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult()]);
      }

      if (url === "/api/games/resolve") {
        resolveAttempts += 1;
        return createJsonResponse(
          resolveAttempts === 1
            ? createSearchResult({
                hltb_status: "unresolved",
                hltb_match_name: null,
                main_story_hours: null,
                main_extra_hours: null,
                completionist_hours: null,
              })
            : createSearchResult(),
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
      await user.click(
        within(gamesPanel).getByRole("button", {
          name: /retry hollow knight playtime/i,
        }),
      );

      await waitFor(() =>
        expect(
          within(gamesPanel).getByRole("button", {
            name: /use main time: 27\.5 hours/i,
          }),
        ).toBeTruthy(),
      );
      expect(resolveAttempts).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("reorders games deterministically and removes the selected item", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const secondCatalog = createCatalogResult({
      igdb_id: 11,
      name: "Celeste",
    });
    const secondResolved = createSearchResult({
      igdb_id: 11,
      name: "Celeste",
    });

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);

      if (url.startsWith("/api/games/search?")) {
        return createJsonResponse([createCatalogResult(), secondCatalog]);
      }

      if (url === "/api/games/resolve") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          igdb_id?: number;
        };
        return createJsonResponse(
          body.igdb_id === 11 ? secondResolved : createSearchResult(),
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

      await user.type(searchInput, "ga");
      await waitFor(() =>
        expect(
          view.getByRole("button", { name: /add hollow knight to backlog/i }),
        ).toBeTruthy(),
      );
      await user.click(
        view.getByRole("button", { name: /add hollow knight to backlog/i }),
      );
      await user.click(
        view.getByRole("button", { name: /add celeste to backlog/i }),
      );

      const currentList = view.getByRole("region", { name: /current list/i });
      await waitFor(() =>
        expect(
          within(currentList).getAllByRole("heading", { level: 3 }),
        ).toHaveLength(2),
      );
      const listTitles = () =>
        within(currentList)
          .getAllByRole("heading", { level: 3 })
          .map((heading) => heading.textContent);

      expect(listTitles()).toEqual(["Hollow Knight", "Celeste"]);
      await user.click(
        within(currentList).getByRole("button", {
          name: /move hollow knight later/i,
        }),
      );
      expect(listTitles()).toEqual(["Celeste", "Hollow Knight"]);

      await user.click(
        within(currentList).getAllByRole("button", { name: /^remove$/i })[0],
      );
      expect(listTitles()).toEqual(["Hollow Knight"]);
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

      expect(view.getAllByText(/hollow knight/i).length).toBeGreaterThan(0);
      expect(view.getAllByDisplayValue(/my backlog/i)).toHaveLength(1);
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
        expect(view.getByDisplayValue(/my backlog/i)).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByLabelText(/monday/i));
      await user.click(view.getByRole("button", { name: /save play time/i }));

      await user.click(view.getByRole("tab", { name: /schedule/i }));
      await user.click(
        view.getByRole("button", { name: /generate schedule/i }),
      );

      await waitFor(() =>
        expect(
          within(view.getByRole("tabpanel")).getByRole("heading", {
            level: 2,
            name: /your schedule/i,
          }),
        ).toBeTruthy(),
      );

      const schedulePanel = view.getByRole("tabpanel");
      expect(
        within(schedulePanel).getByText(/total planned hours/i),
      ).toBeTruthy();
      expect(within(schedulePanel).getByText(/estimated finish/i)).toBeTruthy();
      expect(within(schedulePanel).getByText(/^sessions$/i)).toBeTruthy();
      expect(within(schedulePanel).getByText(/days to finish/i)).toBeTruthy();
      expect(within(schedulePanel).getByText(/^2$/)).toBeTruthy();
      expect(within(schedulePanel).getByText(/3 days/i)).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("invalidates a generated schedule when start date or algorithm changes", async () => {
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
        expect(view.getByDisplayValue(/my backlog/i)).toBeTruthy(),
      );

      await user.click(view.getByRole("tab", { name: /availability/i }));
      await user.click(view.getByLabelText(/monday/i));
      await user.click(view.getByRole("button", { name: /save play time/i }));

      await user.click(view.getByRole("tab", { name: /schedule/i }));

      const schedulePanel = () => view.getByRole("tabpanel");
      const generateSchedule = async () => {
        await user.click(
          within(schedulePanel()).getByRole("button", {
            name: /generate schedule|generated/i,
          }),
        );

        await waitFor(() =>
          expect(
            within(schedulePanel()).getByRole("heading", {
              level: 2,
              name: /your schedule/i,
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
            name: /your schedule/i,
          }),
        ).toBeNull(),
      );
      expect(
        within(schedulePanel()).queryByRole("button", {
          name: /download \.ics/i,
        }),
      ).toBeNull();

      await generateSchedule();

      await user.click(view.getByRole("tab", { name: /availability/i }));
      expect(view.getByText(/schedule already exists/i)).toBeTruthy();
      await user.click(view.getByLabelText(/tuesday/i));
      await user.click(
        view.getByRole("button", { name: /save play time|saved/i }),
      );
      await user.click(view.getByRole("tab", { name: /schedule/i }));

      expect(
        within(view.getByRole("tabpanel")).queryByRole("heading", {
          level: 2,
          name: /your schedule/i,
        }),
      ).toBeNull();

      await user.selectOptions(
        within(schedulePanel()).getByLabelText(/schedule method/i),
        "alternating",
      );

      await waitFor(() =>
        expect(
          within(schedulePanel()).queryByRole("heading", {
            level: 2,
            name: /your schedule/i,
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
