import { describe, expect, test } from "bun:test";
import { render, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";

import { HomePage } from "./home";

describe("HomePage", () => {
  test("renders the tabbed planner shell without the removed landing sections", () => {
    const view = render(<HomePage path="/" />);
    const activePanel = view.getByRole("tabpanel");

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
    expect(within(activePanel).getByText(/search games/i)).toBeTruthy();
    expect(within(activePanel).queryByText(/weekly cadence/i)).toBeNull();
    expect(within(activePanel).queryByText(/your gaming schedule/i)).toBeNull();
    expect(view.queryByRole("complementary")).toBeNull();
  });

  test("switches planner steps manually through the top tabs", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);

    await user.click(view.getByRole("tab", { name: /availability/i }));
    let activePanel = view.getByRole("tabpanel");
    expect(activePanel.id).toBe("planner-panel-availability");
    expect(within(activePanel).getByText(/weekly cadence/i)).toBeTruthy();
    expect(within(activePanel).queryByText(/search games/i)).toBeNull();

    await user.click(view.getByRole("tab", { name: /schedule/i }));
    activePanel = view.getByRole("tabpanel");
    expect(activePanel.id).toBe("planner-panel-schedule");
    expect(
      within(activePanel).getByRole("button", { name: /generate schedule/i }),
    ).toBeTruthy();
    expect(within(activePanel).queryByText(/weekly cadence/i)).toBeNull();
    expect(within(activePanel).queryByText(/ready to plan/i)).toBeNull();
    expect(within(activePanel).queryByText(/before you generate/i)).toBeNull();
  });

  test("preserves step-local draft state when switching tabs", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);
    let activePanel = view.getByRole("tabpanel");

    const searchInput = within(activePanel).getByRole("textbox", {
      name: /search by title/i,
    });
    await user.type(searchInput, "z");
    expect((searchInput as HTMLInputElement).value).toBe("z");

    await user.click(view.getByRole("tab", { name: /availability/i }));
    await user.click(view.getByRole("tab", { name: /games/i }));

    activePanel = view.getByRole("tabpanel");
    const restoredSearchInput = within(activePanel).getByRole("textbox", {
      name: /search by title/i,
    });
    expect((restoredSearchInput as HTMLInputElement).value).toBe("z");
  });

  test("supports horizontal keyboard navigation for the tablist", async () => {
    const user = userEvent.setup();

    const view = render(<HomePage path="/" />);
    const gamesTab = view.getByRole("tab", { name: /games/i });
    const availabilityTab = view.getByRole("tab", { name: /availability/i });
    const scheduleTab = view.getByRole("tab", { name: /schedule/i });

    expect(gamesTab.getAttribute("tabindex")).toBe("0");
    expect(availabilityTab.getAttribute("tabindex")).toBe("-1");
    expect(scheduleTab.getAttribute("tabindex")).toBe("-1");

    gamesTab.focus();
    expect(document.activeElement).toBe(gamesTab);

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(availabilityTab);
    expect(availabilityTab.getAttribute("aria-selected")).toBe("true");
    expect(availabilityTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-availability");

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(scheduleTab);
    expect(scheduleTab.getAttribute("aria-selected")).toBe("true");
    expect(scheduleTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-schedule");

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(gamesTab);
    expect(gamesTab.getAttribute("aria-selected")).toBe("true");
    expect(gamesTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-games");

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(scheduleTab);
    expect(scheduleTab.getAttribute("aria-selected")).toBe("true");
    expect(scheduleTab.getAttribute("tabindex")).toBe("0");
    expect(view.getByRole("tabpanel").id).toBe("planner-panel-schedule");
  });
});
