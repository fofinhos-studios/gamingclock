import { render } from "@testing-library/preact";
import { fireEvent, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { getGameArtwork, searchGameGroups, searchGames } from "../services/api";
import { GameSearch } from "./game-search";

vi.mock("../services/api", () => ({
  searchGames: vi.fn(),
  searchGameGroups: vi.fn().mockResolvedValue([]),
  previewGameGroup: vi.fn(),
  getGameArtwork: vi.fn(),
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
