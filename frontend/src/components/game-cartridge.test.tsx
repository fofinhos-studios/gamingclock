import { render } from "@testing-library/preact";
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
  test("renders hero, logo, cover, and a playtime nutrition label", () => {
    const view = render(<GameCartridge game={game} />);

    expect(view.getByAltText("Hollow Knight logo")).toBeTruthy();
    expect(view.getByAltText("Hollow Knight cover")).toBeTruthy();
    expect(
      view.container
        .querySelector(".game-cartridge__hero")
        ?.getAttribute("src"),
    ).toBe(game.hero_url);
    expect(view.getByText("PLAY TIME")).toBeTruthy();
    expect(view.getByText("27.5H")).toBeTruthy();
  });
});
