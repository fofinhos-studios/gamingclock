import { render } from "@testing-library/preact";
import { fireEvent, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import {
  getGameArtwork,
  previewGameGroup,
  searchGameGroups,
  searchGames,
} from "../services/api";
import { GameSearch } from "./game-search";

vi.mock("../services/api", () => ({
  searchGames: vi.fn(),
  searchGameGroups: vi.fn().mockResolvedValue([]),
  previewGameGroup: vi.fn(),
  getGameArtwork: vi.fn().mockResolvedValue({
    cover_url: "",
    logo_url: "",
    hero_url: "",
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchGameGroups).mockResolvedValue([]);
});

describe("GameSearch", () => {
  test("renders as a compact spotlight search dock before a query", () => {
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );

    expect(view.container.querySelector(".planner-search-dock")).toBeTruthy();
    expect(
      view.container.querySelector(".planner-search-dock__field"),
    ).toBeTruthy();
    expect(view.container.querySelector(".planner-search-results")).toBeNull();
  });

  test("uses a randomly selected pair of games in the search placeholder", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );

    expect(
      view
        .getByRole("textbox", { name: /search by title/i })
        .getAttribute("placeholder"),
    ).toBe("Try “Hollow Knight” or “Mario Kart 8 Deluxe”");
    random.mockRestore();
  });

  test("keeps a result name and cover visible while its cartridge artwork loads", async () => {
    const user = userEvent.setup();
    const artwork = Promise.withResolvers<{
      cover_url: string;
      logo_url: string;
      hero_url: string;
    }>();
    vi.mocked(searchGames).mockResolvedValue([
      {
        igdb_id: 7,
        name: "Dragon Quest XI",
        cover_url: "https://images.example/t_thumb/dragon-quest.jpg",
        summary: "A long adventure.",
        genres: ["RPG"],
        platforms: ["PC"],
        release_year: 2017,
        rating: 88.4,
      },
    ]);
    vi.mocked(getGameArtwork).mockReturnValue(artwork.promise);

    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );

    await user.type(
      view.getByRole("textbox", { name: /search by title/i }),
      "dr",
    );

    await waitFor(() => expect(view.getByText("Dragon Quest XI")).toBeTruthy());
    expect(view.getByAltText("Dragon Quest XI")).toBeTruthy();
    expect(
      view.container.querySelector(".planner-result__artwork-loading"),
    ).toBeTruthy();

    artwork.resolve({
      cover_url: "",
      logo_url: "https://images.example/dragon-quest-logo.png",
      hero_url: "https://images.example/dragon-quest-hero.jpg",
    });

    const logo = await view.findByAltText("Dragon Quest XI logo");
    expect(view.getByRole("heading", { name: "Dragon Quest XI" })).toBeTruthy();
    const hero = view.container.querySelector(".planner-result__hero");
    expect(hero).toBeTruthy();
    fireEvent.load(logo);
    fireEvent.load(hero as HTMLImageElement);

    await waitFor(() =>
      expect(
        view.container.querySelector(".planner-result__artwork-loading"),
      ).toBeNull(),
    );
    expect(
      view.container
        .querySelector(".platform-icons__icon")
        ?.getAttribute("src"),
    ).toContain("Platforms-Logos/main/Windows.png");
  });

  test("shows ordinary games without waiting for optional group discovery", async () => {
    const user = userEvent.setup();
    const groups =
      Promise.withResolvers<Awaited<ReturnType<typeof searchGameGroups>>>();
    vi.mocked(searchGameGroups).mockReturnValue(groups.promise);
    vi.mocked(searchGames).mockResolvedValue([
      {
        igdb_id: 11,
        name: "Kingdom Hearts",
        cover_url: "",
        summary: "",
        genres: [],
        platforms: [],
        release_year: 2002,
        rating: null,
      },
    ]);

    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );

    await user.type(
      view.getByRole("textbox", { name: /search by title/i }),
      "ki",
    );

    expect(await view.findByText("Kingdom Hearts")).toBeTruthy();
    groups.resolve([]);
  });

  test("keeps expanded releases together while allowing the player to add one", async () => {
    const user = userEvent.setup();
    const onAddGame = vi.fn();
    vi.mocked(searchGames).mockResolvedValue([
      {
        igdb_id: 1802,
        name: "Chrono Trigger",
        cover_url: "",
        summary: "The original release.",
        genres: ["RPG"],
        platforms: ["Super Nintendo"],
        release_year: 1995,
        rating: 92,
        game_type: "main_game",
        variants: [
          {
            igdb_id: 20398,
            name: "Chrono Trigger",
            cover_url: "",
            summary: "An expanded release.",
            genres: ["RPG"],
            platforms: ["Nintendo DS"],
            release_year: 2008,
            rating: null,
            game_type: "expanded_game",
            version_parent: null,
            parent_game: null,
            version_title: null,
          },
        ],
      },
    ]);

    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={onAddGame} />
      </LanguageProvider>,
    );

    await user.type(
      view.getByRole("textbox", { name: /search by title/i }),
      "ch",
    );

    const versionButton = await view.findByRole("button", {
      name: "Add Chrono Trigger (Expanded version) to backlog",
    });
    expect(view.getByText("Nintendo DS · 2008")).toBeTruthy();

    await user.click(versionButton);

    expect(onAddGame).toHaveBeenCalledWith(
      expect.objectContaining({
        igdb_id: 20398,
        game_type: "expanded_game",
        variants: [],
      }),
    );
  });

  test("remains dismissible when a lower-ranked result omits its rating", async () => {
    const user = userEvent.setup();
    vi.mocked(searchGames).mockResolvedValue([
      {
        igdb_id: 1802,
        name: "Chrono Trigger",
        cover_url: "",
        summary: "The original release.",
        genres: ["RPG"],
        platforms: ["Super Nintendo"],
        release_year: 1995,
        rating: 93.2,
      },
      {
        igdb_id: 263447,
        name: "Chrono Trigger",
        cover_url: "",
        summary: "A mobile port.",
        genres: ["RPG"],
        platforms: ["Legacy Mobile Device"],
        game_type: "port",
      },
    ] as Awaited<ReturnType<typeof searchGames>>);

    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );

    await user.type(
      view.getByRole("textbox", { name: /search by title/i }),
      "ch",
    );

    await waitFor(() =>
      expect(
        view.getAllByRole("button", {
          name: "Add Chrono Trigger to backlog",
        }),
      ).toHaveLength(2),
    );

    fireEvent.mouseDown(document.body);

    await waitFor(() =>
      expect(
        view.queryAllByRole("button", {
          name: "Add Chrono Trigger to backlog",
        }),
      ).toHaveLength(0),
    );
  });

  test("shows preview members after expanding a group card", async () => {
    const user = userEvent.setup();
    vi.mocked(searchGames).mockResolvedValue([]);
    vi.mocked(searchGameGroups).mockResolvedValue([
      {
        group_key: "igdb:collection:123",
        display_name: "Final Fantasy — series",
        scope_name: "series",
        card_kind: "series",
        candidate_count: 2,
        sources: [{ source: "igdb", label: "IGDB collection" }],
        warning: null,
      },
    ]);
    vi.mocked(previewGameGroup).mockResolvedValue({
      group: {
        group_key: "igdb:collection:123",
        display_name: "Final Fantasy — series",
        scope_name: "series",
        card_kind: "series",
        candidate_count: 2,
        sources: [{ source: "igdb", label: "IGDB collection" }],
        warning: null,
      },
      items: [
        {
          source_id: "igdb:1",
          name: "Final Fantasy",
          release_year: 1987,
          igdb_id: 1,
          order: 1,
          initially_selected: true,
          already_in_backlog: false,
          evidence: [],
          edition: { state: "canonical", label: "Canonical release" },
        },
      ],
      excluded_items: [],
      possible_matches: [],
      unavailable_sources: [],
      rawg_attribution_required: false,
      rawg_attribution_url: null,
    });
    vi.mocked(getGameArtwork).mockResolvedValue({
      cover_url: "https://images.example/final-fantasy-cover.png",
      logo_url: "https://images.example/final-fantasy-logo.png",
      hero_url: "https://images.example/final-fantasy-hero.png",
    });

    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );

    await user.type(
      view.getByRole("textbox", { name: /search by title/i }),
      "final",
    );
    const expandButton = await view.findByRole("button", {
      name: "Expand Final Fantasy — series",
    });
    await user.click(expandButton);

    expect(await view.findByRole("checkbox")).toBeTruthy();
    expect(view.getByText("Canonical release")).toBeTruthy();
    expect(await view.findByAltText("Final Fantasy logo")).toBeTruthy();
    expect(getGameArtwork).toHaveBeenCalledWith(
      expect.objectContaining({ igdb_id: 0, name: "Final Fantasy" }),
      expect.any(AbortSignal),
    );
  });

  test("keeps the newest search results when an earlier request finishes late", async () => {
    const user = userEvent.setup();
    const firstSearch =
      Promise.withResolvers<
        Parameters<typeof searchGames>[0] extends string
          ? Awaited<ReturnType<typeof searchGames>>
          : never
      >();
    const secondSearch =
      Promise.withResolvers<
        Parameters<typeof searchGames>[0] extends string
          ? Awaited<ReturnType<typeof searchGames>>
          : never
      >();
    vi.mocked(searchGames)
      .mockReturnValueOnce(firstSearch.promise)
      .mockReturnValueOnce(secondSearch.promise);

    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameSearch games={[]} onAddGame={vi.fn()} />
      </LanguageProvider>,
    );
    const searchInput = view.getByRole("textbox", {
      name: /search by title/i,
    });

    await user.type(searchInput, "fi");
    await waitFor(() =>
      expect(searchGames).toHaveBeenCalledWith("fi", expect.any(AbortSignal)),
    );
    await user.type(searchInput, "nal");
    await waitFor(() =>
      expect(searchGames).toHaveBeenLastCalledWith(
        "final",
        expect.any(AbortSignal),
      ),
    );

    secondSearch.resolve([
      {
        igdb_id: 22,
        name: "Chrono Trigger",
        cover_url: "",
        summary: "",
        genres: [],
        platforms: [],
        release_year: 1995,
        rating: null,
      },
    ]);
    expect(await view.findByText("Chrono Trigger")).toBeTruthy();

    firstSearch.resolve([
      {
        igdb_id: 7,
        name: "Final Fantasy VII",
        cover_url: "",
        summary: "",
        genres: [],
        platforms: [],
        release_year: 1997,
        rating: null,
      },
    ]);

    await waitFor(() =>
      expect(view.queryByText("Final Fantasy VII")).toBeNull(),
    );
    expect(view.getByText("Chrono Trigger")).toBeTruthy();
  });
});
