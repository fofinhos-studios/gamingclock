import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";

import { HomePage } from "./home";

describe("HomePage", () => {
  test("renders the tabbed planner shell without the removed landing sections", () => {
    const view = render(<HomePage path="/" />);

    expect(view.getByRole("link", { name: /skip to planner/i })).toBeTruthy();
    expect(view.getByRole("main")).toBeTruthy();
    expect(
      view.getByRole("heading", { level: 1, name: /gaming clock/i }),
    ).toBeTruthy();
    expect(view.getByRole("tab", { name: /games/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /availability/i })).toBeTruthy();
    expect(view.getByRole("tab", { name: /schedule/i })).toBeTruthy();
    expect(view.queryByText(/gaming backlog planner/i)).toBeNull();
    expect(view.queryByText(/^workflow$/i)).toBeNull();
    expect(view.queryByText(/^overview$/i)).toBeNull();
    expect(view.getByText(/search games/i)).toBeTruthy();
    expect(view.queryByText(/weekly cadence/i)).toBeNull();
    expect(view.queryByText(/your gaming schedule/i)).toBeNull();
  });

  test("switches planner steps manually through the top tabs", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);

    await user.click(view.getByRole("tab", { name: /availability/i }));
    expect(view.getByText(/weekly cadence/i)).toBeTruthy();
    expect(view.queryByText(/search games/i)).toBeNull();

    await user.click(view.getByRole("tab", { name: /schedule/i }));
    expect(
      view.getByRole("button", { name: /generate schedule/i }),
    ).toBeTruthy();
    expect(view.queryByText(/weekly cadence/i)).toBeNull();
  });
});
