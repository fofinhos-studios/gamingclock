import { fireEvent, render, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import type { ListGame } from "../types";
import { GameListView } from "./game-list-view";

const game: ListGame = {
  igdb_id: 1,
  name: "Hollow Knight",
  cover_url: null,
  logo_url: null,
  hero_url: null,
  summary: "",
  genres: [],
  platforms: [],
  release_year: 2017,
  rating: null,
  hltb_status: "resolved",
  hltb_match_name: "Hollow Knight",
  main_story_hours: 27.5,
  main_extra_hours: 40,
  completionist_hours: 60,
};

describe("GameListView", () => {
  test("uses the list name as the only heading and reveals editing on demand", async () => {
    const user = userEvent.setup();
    const onRenameList = vi.fn();
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameListView
          name="My backlog"
          games={[]}
          onRemoveGame={vi.fn()}
          onSelectGameTime={vi.fn()}
          onRetryGame={vi.fn()}
          onMoveGame={vi.fn()}
          onReorderGames={vi.fn()}
          onRenameList={onRenameList}
        />
      </LanguageProvider>,
    );

    expect(view.getByRole("heading", { name: "My backlog" })).toBeTruthy();
    expect(view.queryByText("Current list")).toBeNull();
    expect(view.queryByLabelText("Backlog name")).toBeNull();

    await user.click(view.getByRole("button", { name: "Rename My backlog" }));

    const nameInput = view.getByLabelText("Backlog name");
    await user.clear(nameInput);
    await user.type(nameInput, "Weekend games");
    await user.keyboard("{Enter}");

    expect(onRenameList).toHaveBeenCalledWith("Weekend games");
  });

  test("keeps the release year out of the selectable playtime controls", () => {
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameListView
          name="My backlog"
          games={[game]}
          onRemoveGame={vi.fn()}
          onSelectGameTime={vi.fn()}
          onRetryGame={vi.fn()}
          onMoveGame={vi.fn()}
          onReorderGames={vi.fn()}
          onRenameList={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(
      view.container.querySelector(".planner-chip-group")?.textContent,
    ).not.toContain("2017");
  });

  test("formats fractional HLTB durations as hours and minutes", () => {
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameListView
          name="My backlog"
          games={[{ ...game, main_story_hours: 28.438333333333333 }]}
          onRemoveGame={vi.fn()}
          onSelectGameTime={vi.fn()}
          onRetryGame={vi.fn()}
          onMoveGame={vi.fn()}
          onReorderGames={vi.fn()}
          onRenameList={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(view.getByText("28h 26m main")).toBeTruthy();
  });

  test("reorders a game when it is dropped onto another card", async () => {
    const onReorderGames = vi.fn();
    const secondGame = { ...game, igdb_id: 2, name: "Celeste" };
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <GameListView
          name="My backlog"
          games={[game, secondGame]}
          onRemoveGame={vi.fn()}
          onSelectGameTime={vi.fn()}
          onRetryGame={vi.fn()}
          onMoveGame={vi.fn()}
          onReorderGames={onReorderGames}
          onRenameList={vi.fn()}
        />
      </LanguageProvider>,
    );

    const cards = view.container.querySelectorAll(".planner-backlog-row");
    fireEvent.dragStart(cards[1]);
    await waitFor(() =>
      expect(
        cards[1]?.classList.contains("planner-backlog-row--dragging"),
      ).toBe(true),
    );
    fireEvent.dragOver(cards[0]);
    fireEvent.drop(cards[0]);

    expect(onReorderGames).toHaveBeenCalledWith(1, 0);
  });
});
