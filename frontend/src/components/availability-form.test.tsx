import { fireEvent, render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { AvailabilityForm } from "./availability-form";

function renderForm(onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <LanguageProvider browserLanguages={["en"]}>
        <AvailabilityForm availability={null} onChange={onChange} />
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

  test("updates the live weekly total for selected days and uniform duration", async () => {
    const user = userEvent.setup();
    const view = renderForm();

    await user.click(view.getByLabelText("Monday"));
    await user.click(view.getByLabelText("Tuesday"));
    const hours = view.getByLabelText("Hours");
    await user.clear(hours);
    await user.type(hours, "2");
    await user.selectOptions(view.getByLabelText("Minutes"), "30");

    expect(view.getByRole("status").textContent).toContain("5h per week");
  });

  test("accepts durations beyond the former 16-hour limit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange);

    await user.click(view.getByLabelText("Monday"));
    const hours = view.getByLabelText("Hours");
    await user.clear(hours);
    await user.type(hours, "25");
    await user.selectOptions(view.getByLabelText("Minutes"), "15");

    expect(onChange).toHaveBeenLastCalledWith({
      days: [{ day_of_week: 0, hours: 25.25, start_hour: 20, start_minute: 0 }],
    });
  });

  test("clears availability immediately when no play days are selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange);

    await user.click(view.getByRole("button", { name: "Weeknights" }));
    await user.click(view.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test("accepts a start time with minutes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange);

    await user.click(view.getByLabelText("Monday"));
    const startTime = view.getByLabelText(/^Start time/);

    expect(startTime.getAttribute("type")).toBe("time");
    fireEvent.input(startTime, { target: { value: "18:30" } });

    expect(onChange).toHaveBeenLastCalledWith({
      days: [{ day_of_week: 0, hours: 2, start_hour: 18, start_minute: 30 }],
    });
  });
});
