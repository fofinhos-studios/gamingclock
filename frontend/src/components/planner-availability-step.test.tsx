import { render } from "@testing-library/preact";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import type { WeeklyAvailability } from "../types";
import { PlannerAvailabilityStep } from "./planner-availability-step";

const availability: WeeklyAvailability = {
  days: [{ day_of_week: 1, hours: 2, start_hour: 19 }],
};

describe("PlannerAvailabilityStep", () => {
  test("shows only the availability controls, without status summary cards", () => {
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <PlannerAvailabilityStep
          availability={availability}
          onChange={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(view.getByRole("group", { name: /weekly schedule/i })).toBeTruthy();
    expect(view.queryByText(/^status$/i)).toBeNull();
    expect(view.queryByText(/availability set/i)).toBeNull();
    expect(view.queryByText(/updates automatically as you change/i)).toBeNull();
    expect(view.queryByText(/^current backlog$/i)).toBeNull();
    expect(view.queryByText(/3 games in this backlog/i)).toBeNull();
    expect(view.queryByText(/change your play time before/i)).toBeNull();
  });
});
