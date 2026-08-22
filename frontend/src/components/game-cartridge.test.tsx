import { fireEvent, render, waitFor } from "@testing-library/preact";
import { describe, expect, test } from "vitest";

import type { ListGame } from "../types";
import { GameCartridge } from "./game-cartridge";

const game: ListGame = {
  igdb_id: 1,
  name: "Hollow Knight",
  cover_url: "https://images.example/hollow-knight-cover.jpg",
  logo_url: "https://images.example/hollow-knight-logo.png",
  hero_url: "https://images.example/hollow-knight-hero.jpg",
  summary: "",
  genres: ["Adventure"],
  platforms: ["PC"],
  release_year: 2017,
  rating: 90,
  hltb_status: "resolved",
  hltb_match_name: "Hollow Knight",
  main_story_hours: 27.5,
  main_extra_hours: 40,
  completionist_hours: 60,
};

describe("GameCartridge", () => {
  test("keeps its loading shell visible until the HLTB duration lookup resolves", async () => {
    const pendingGame = { ...game, hltb_status: "loading" as const };
    const view = render(<GameCartridge game={pendingGame} />);

    fireEvent.load(
      view.container.querySelector(".game-cartridge__hero") as HTMLImageElement,
    );
    fireEvent.load(view.getByAltText("Hollow Knight cover"));
    fireEvent.load(view.getByAltText("Hollow Knight logo"));

    await waitFor(() =>
      expect(
        view.container
          .querySelector(".game-cartridge")
          ?.getAttribute("aria-busy"),
      ).toBe("true"),
    );
  });

  test("reveals hero, logo, cover, and a playtime nutrition label once artwork is ready", async () => {
    const view = render(<GameCartridge game={game} />);

    expect(view.getByLabelText(/loading hollow knight artwork/i)).toBeTruthy();
    expect(
      view.container
        .querySelector(".game-cartridge")
        ?.getAttribute("aria-busy"),
    ).toBe("true");

    fireEvent.load(
      view.container.querySelector(".game-cartridge__hero") as HTMLImageElement,
    );
    fireEvent.load(view.getByAltText("Hollow Knight cover"));
    fireEvent.load(view.getByAltText("Hollow Knight logo"));

    await waitFor(() =>
      expect(
        view.container
          .querySelector(".game-cartridge")
          ?.getAttribute("aria-busy"),
      ).toBe("false"),
    );
    expect(view.getByAltText("Hollow Knight logo")).toBeTruthy();
    expect(view.getByAltText("Hollow Knight cover")).toBeTruthy();
    expect(
      view.container
        .querySelector(".game-cartridge__hero")
        ?.getAttribute("src"),
    ).toBe(game.hero_url);
    expect(view.getByText("PLAY TIME")).toBeTruthy();
    expect(view.getByText("27.5H")).toBeTruthy();
    expect(view.getByText("GENRE")).toBeTruthy();
    expect(view.getByText("Adventure")).toBeTruthy();
  });

  test("shows calendar sessions as a clock icon and their planned hours", () => {
    const view = render(
      <GameCartridge game={game} plannedHours={2.5} variant="calendar" />,
    );

    expect(view.getByText("2.5H")).toBeTruthy();
    const primaryDetail = view
      .getByLabelText("Hollow Knight details")
      .querySelector("div");
    expect(primaryDetail?.querySelector("dt span")).toBeNull();
    expect(
      primaryDetail?.querySelector("dt [aria-hidden='true']"),
    ).toBeTruthy();
    expect(view.queryByText("TODAY")).toBeNull();
    expect(view.queryByText("TIME TO PLAY")).toBeNull();
  });
});
