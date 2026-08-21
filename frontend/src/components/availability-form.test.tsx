import { render } from "@testing-library/preact";
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
      days: [{ day_of_week: 0, hours: 25.25, start_hour: 20 }],
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

  test("uses the shared select for whole-hour start times", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderForm(onChange);

    await user.click(view.getByLabelText("Monday"));
    const startTime = view.getByLabelText(/^Start time/);

    expect(startTime.tagName).toBe("SELECT");
    expect(startTime.classList.contains("ui-select")).toBe(true);
    expect(
      Array.from(
        (startTime as HTMLSelectElement).options,
        (option) => option.value,
      ),
    ).toEqual([
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
    ]);
    await user.selectOptions(startTime, "18:00");

    expect(onChange).toHaveBeenLastCalledWith({
      days: [{ day_of_week: 0, hours: 2, start_hour: 18 }],
    });
  });
});
