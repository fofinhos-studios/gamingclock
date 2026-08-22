import { render } from "@testing-library/preact";
import { h } from "preact";
import { expect, test } from "vitest";

import { SurfaceWordmark } from "./surface-wordmark";

test("renders an accessible plain-text wordmark", () => {
  const view = render(h(SurfaceWordmark, {}));

  expect(view.getByRole("img", { name: "Gaming Clock" })).toBeTruthy();
  expect(
    view.container.querySelector(".planner-identity__label")?.textContent,
  ).toBe("Gaming Clock");
  expect(view.container.querySelector("canvas")).toBeNull();
});
