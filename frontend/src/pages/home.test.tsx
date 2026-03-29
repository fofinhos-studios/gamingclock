import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";

import { HomePage } from "./home";

describe("HomePage", () => {
  test("renders an accessible planner shell with a skip link", () => {
    const view = render(<HomePage path="/" />);

    expect(view.getByRole("link", { name: /skip to planner/i })).toBeTruthy();
    expect(view.getByRole("main")).toBeTruthy();
    expect(
      view.getByRole("heading", { level: 1, name: /gaming clock/i }),
    ).toBeTruthy();
  });
});
