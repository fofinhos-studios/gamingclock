import { render, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { searchGameGroups, searchGames } from "../services/api";
import { GameSearch } from "./game-search";

vi.mock("../config/features", () => ({
  GAME_GROUPS_ENABLED: false,
}));

vi.mock("../services/api", () => ({
  searchGames: vi.fn(),
  searchGameGroups: vi.fn(),
  previewGameGroup: vi.fn(),
  getGameArtwork: vi.fn().mockResolvedValue({
    cover_url: "",
    logo_url: "",
    hero_url: "",
  }),
}));

afterEach(() => vi.clearAllMocks());

test("searches games without requesting or rendering disabled game groups", async () => {
  const user = userEvent.setup();
  vi.mocked(searchGames).mockResolvedValue([
    {
      igdb_id: 11,
      name: "Kingdom Hearts II",
      cover_url: "",
      summary: "",
      genres: [],
      platforms: [],
      release_year: 2005,
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
    "kingdom hearts",
  );

  expect(await view.findByText("Kingdom Hearts II")).toBeTruthy();
  await waitFor(() =>
    expect(searchGames).toHaveBeenLastCalledWith(
      "kingdom hearts",
      expect.any(AbortSignal),
    ),
  );
  expect(searchGameGroups).not.toHaveBeenCalled();
  expect(view.queryByText("Related game groups are unavailable.")).toBeNull();
});
