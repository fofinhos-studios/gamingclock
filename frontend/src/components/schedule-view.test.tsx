import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";

import type { ScheduleResponse } from "../types";
import { ScheduleView } from "./schedule-view";

const schedule: ScheduleResponse = {
  sessions: [
    {
      game_name: "Disco Elysium",
      date: "2026-03-30",
      start_time: "20:00",
      duration_hours: 2.5,
    },
    {
      game_name: "Outer Wilds",
      date: "2026-04-01",
      start_time: "21:00",
      duration_hours: 1.5,
    },
  ],
  total_hours: 4,
  estimated_end_date: "2026-04-03",
};

describe("ScheduleView", () => {
  test("renders sessions as a timeline instead of the old table layout", () => {
    const view = render(
      <ScheduleView schedule={schedule} onDownloadIcal={() => {}} />,
    );

    expect(view.getAllByText(/play sessions/i).length).toBeGreaterThan(0);
    expect(view.queryByRole("table")).toBeNull();
    expect(view.getAllByRole("article")).toHaveLength(2);
  });

  test("shows the total elapsed days from the first and last session dates", () => {
    const view = render(
      <ScheduleView schedule={schedule} onDownloadIcal={() => {}} />,
    );

    expect(view.getByText(/days to finish/i)).toBeTruthy();
    expect(view.getByText(/3 days/i)).toBeTruthy();
  });
});
