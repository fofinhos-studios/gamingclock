import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { AvailabilityForm } from "./availability-form";

function renderForm(
  onChange = vi.fn(),
  availability: Parameters<typeof AvailabilityForm>[0]["availability"] = null,
) {
  return {
    onChange,
    ...render(
      <LanguageProvider browserLanguages={["en"]}>
        <AvailabilityForm availability={availability} onChange={onChange} />
      </LanguageProvider>,
    ),
  };
}

describe("AvailabilityForm", () => {
  test("shows the whole week and creates a one-hour event when an empty time is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange);

    expect(
      view.container.querySelector(".availability-week__calendar"),
    ).toBeTruthy();
    await user.click(view.getByRole("button", { name: "Monday at 20:00" }));

    expect(onChange).toHaveBeenLastCalledWith({
      days: [{ day_of_week: 0, hours: 1, start_hour: 20, start_minute: 0 }],
    });
    expect(view.getByLabelText("Monday, 1h from 20:00")).toBeTruthy();
  });

  test("offers week presets and clears the weekly calendar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange);

    await user.click(view.getByRole("button", { name: "Weeknights" }));
    expect(onChange).toHaveBeenLastCalledWith({
      days: [0, 1, 2, 3, 4].map((day_of_week) => ({
        day_of_week,
        hours: 2,
        start_hour: 20,
        start_minute: 0,
      })),
    });

    await user.click(view.getByRole("button", { name: "Clear week" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test("moves a selected block in half-hour increments from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange, {
      days: [{ day_of_week: 0, hours: 2, start_hour: 18, start_minute: 30 }],
    });

    await user.click(view.getByLabelText("Monday, 2h from 18:30"));
    await user.keyboard("{ArrowDown}");

    expect(onChange).toHaveBeenLastCalledWith({
      days: [{ day_of_week: 0, hours: 2, start_hour: 19, start_minute: 0 }],
    });
  });
});
