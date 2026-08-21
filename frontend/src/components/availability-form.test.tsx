import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { AvailabilityForm } from "./availability-form";

function renderForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...render(
      <LanguageProvider browserLanguages={["en"]}>
        <AvailabilityForm availability={null} onSubmit={onSubmit} />
      </LanguageProvider>,
    ),
  };
}

describe("AvailabilityForm", () => {
  test("offers useful day presets and keeps them keyboard-operable", async () => {
    const user = userEvent.setup();
    const view = renderForm();

    await user.click(view.getByRole("button", { name: "Weeknights" }));

    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]) {
      expect((view.getByLabelText(day) as HTMLInputElement).checked).toBe(true);
    }
    expect((view.getByLabelText("Saturday") as HTMLInputElement).checked).toBe(
      false,
    );

    await user.click(view.getByRole("button", { name: "Clear" }));
    expect((view.getByLabelText("Monday") as HTMLInputElement).checked).toBe(
      false,
    );
  });

  test("reveals per-day controls only after choosing a custom schedule", async () => {
    const user = userEvent.setup();
    const view = renderForm();

    await user.click(view.getByLabelText("Monday"));
    expect(view.queryByLabelText(/Monday hours/)).toBeNull();

    await user.click(view.getByRole("radio", { name: /customize by day/i }));
    expect(view.getByLabelText(/Monday hours/)).toBeTruthy();
    expect(view.getByLabelText(/Monday start time/)).toBeTruthy();
  });

  test("updates the live weekly total for selected days and uniform hours", async () => {
    const user = userEvent.setup();
    const view = renderForm();

    await user.click(view.getByLabelText("Monday"));
    await user.click(view.getByLabelText("Tuesday"));
    const hours = view.getByLabelText(/Hours per selected day/);
    await user.clear(hours);
    await user.type(hours, "2.5");

    expect(view.getByRole("status").textContent).toContain("5 hours per week");
  });

  test("identifies the missing day selection when saving", async () => {
    const user = userEvent.setup();
    const view = renderForm();

    await user.click(view.getByRole("button", { name: /save play time/i }));

    expect(view.getByRole("alert").textContent).toContain(
      "Choose at least one play day",
    );
  });

  test("reports a clear saved state and serializes the selected whole-hour start time", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const view = renderForm(onSubmit);

    await user.click(view.getByLabelText("Monday"));
    await user.clear(view.getByLabelText(/^Start time/));
    await user.type(view.getByLabelText(/^Start time/), "18:00");
    await user.click(view.getByRole("button", { name: /save play time/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      days: [{ day_of_week: 0, hours: 2, start_hour: 18 }],
    });
    expect(view.getByRole("status").textContent).toContain("Saved");
  });
});
