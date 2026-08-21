import { render, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import type { ScheduleResponse } from "../types";
import { PlannerScheduleStep } from "./planner-schedule-step";

const schedule: ScheduleResponse = {
  sessions: [],
  total_hours: 0,
  estimated_end_date: null,
};

function renderStep(
  overrides: Partial<Parameters<typeof PlannerScheduleStep>[0]> = {},
) {
  const props: Parameters<typeof PlannerScheduleStep>[0] = {
    algorithm: "sequential",
    startDate: "2026-03-30",
    schedule: null,
    actionError: "",
    canGenerateSchedule: false,
    prerequisiteMessages: [],
    gameListName: "My Backlog",
    gameCount: 0,
    totalSelectedHours: 0,
    weeklyHours: 0,
    onNavigate: vi.fn(),
    onAlgorithmChange: vi.fn(),
    onStartDateChange: vi.fn(),
    onGenerateSchedule: vi.fn().mockResolvedValue(true),
    onDownloadIcal: vi.fn().mockResolvedValue(true),
    ...overrides,
  };

  return {
    props,
    ...render(
      <LanguageProvider browserLanguages={["en"]}>
        <PlannerScheduleStep {...props} />
      </LanguageProvider>,
    ),
  };
}

describe("PlannerScheduleStep", () => {
  test("turns missing prerequisites into direct navigation actions", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const view = renderStep({
      onNavigate,
      prerequisiteMessages: [
        {
          id: "games-required",
          message: "Add games before generating.",
          target: "games",
        },
        {
          id: "availability-required",
          message: "Save play time before generating.",
          target: "availability",
        },
      ],
    });

    await user.click(view.getByRole("link", { name: /add games/i }));
    expect(onNavigate).toHaveBeenCalledWith("games");
    await user.click(view.getByRole("link", { name: /save play time/i }));
    expect(onNavigate).toHaveBeenCalledWith("availability");
  });

  test("keeps prerequisite links without schedule-status narration", () => {
    const view = renderStep({
      schedule,
      prerequisiteMessages: [
        {
          id: "games-required",
          message: "Add games before generating.",
          target: "games",
        },
      ],
    });

    expect(view.getByRole("link", { name: /add games/i })).toBeTruthy();
    expect(view.queryByText(/updates automatically/i)).toBeNull();
    expect(view.queryByText(/before your schedule can update/i)).toBeNull();
  });

  test("restores focus to the destination step after prerequisite navigation", async () => {
    const user = userEvent.setup();
    const destinationTab = document.createElement("button");
    destinationTab.id = "planner-tab-games";
    document.body.append(destinationTab);

    try {
      const view = renderStep({
        prerequisiteMessages: [
          {
            id: "games-required",
            message: "Add games before generating.",
            target: "games",
          },
        ],
      });

      await user.click(view.getByRole("link", { name: /add games/i }));

      await waitFor(() => expect(document.activeElement).toBe(destinationTab));
    } finally {
      destinationTab.remove();
    }
  });

  test("shows a ready preview with both algorithm explanations and a localized date", () => {
    const view = renderStep({
      algorithm: "alternating",
      canGenerateSchedule: true,
      gameListName: "Weekend games",
      gameCount: 2,
      totalSelectedHours: 27.5,
      weeklyHours: 5,
    });

    expect(view.getByText("Weekend games")).toBeTruthy();
    expect(view.getByText(/2 games/i)).toBeTruthy();
    expect(view.getByText(/27\.5 hours/i)).toBeTruthy();
    expect(view.getByText(/5 hours per week/i)).toBeTruthy();
    expect(view.getAllByText(/March 30, 2026/i).length).toBeGreaterThan(0);
    expect(view.getAllByText("Rotate games").length).toBeGreaterThan(0);
    expect(view.getByText(/finish one game before the next/i)).toBeTruthy();
    expect(view.getByText(/rotate between games/i)).toBeTruthy();
  });
});
