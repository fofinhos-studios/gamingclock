import { describe, expect, test } from "vitest";

import { isGameGroupsEnabled } from "./features";

describe("isGameGroupsEnabled", () => {
  test("keeps game groups available outside production unless explicitly disabled", () => {
    expect(isGameGroupsEnabled({ PROD: false })).toBe(true);
    expect(
      isGameGroupsEnabled({ PROD: false, VITE_ENABLE_GAME_GROUPS: "false" }),
    ).toBe(false);
  });

  test("requires an explicit production opt-in", () => {
    expect(isGameGroupsEnabled({ PROD: true })).toBe(false);
    expect(
      isGameGroupsEnabled({ PROD: true, VITE_ENABLE_GAME_GROUPS: "true" }),
    ).toBe(true);
  });
});
