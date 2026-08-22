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
  const props = {
    algorithm: "sequential",
    startDate: "2026-03-30",
    planningMode: "weekly",
    finishByDate: null,
    maxSessionHours: 4,
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
    onPlanningModeChange: vi.fn(),
    onFinishByDateChange: vi.fn(),
    onMaxSessionHoursChange: vi.fn(),
    onScheduleChange: vi.fn(),
    onDownloadIcal: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as Parameters<typeof PlannerScheduleStep>[0];

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

  test("keeps the algorithm explanation in a hint and shows a localized date", () => {
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
    expect(
      view.getByLabelText(/rotate games: rotate between games/i),
    ).toBeTruthy();
    expect(view.queryByText(/finish one game before the next/i)).toBeNull();
    expect(view.queryByText(/rotate between games/i)).toBeNull();
  });

  test("explains both planning modes in a hint", () => {
    const view = renderStep();

    expect(
      view.getByLabelText(
        /weekly availability plans only within your chosen hours.*finish by adds the hours/i,
      ),
    ).toBeTruthy();
  });

  test("shows deadline controls only in Finish by mode", () => {
    const view = renderStep({
      planningMode: "finish_by",
      finishByDate: "2026-04-30",
      maxSessionHours: 4,
    });

    expect(view.getByLabelText(/finish by date/i)).toBeTruthy();
    expect(view.getByLabelText(/max session length/i)).toBeTruthy();
    expect(view.getByText(/selected days and start times/i)).toBeTruthy();
  });
});
