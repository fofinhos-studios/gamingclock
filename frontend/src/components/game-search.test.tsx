import { render } from "@testing-library/preact";
import { fireEvent, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { getGameArtwork, searchGames } from "../services/api";
import { GameSearch } from "./game-search";

vi.mock("../services/api", () => ({
  searchGames: vi.fn(),
  getGameArtwork: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

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
});
