import { render } from "@testing-library/preact";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { GameSearch } from "./game-search";

vi.mock("../services/api", () => ({
  searchGames: vi.fn(),
}));

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
});
