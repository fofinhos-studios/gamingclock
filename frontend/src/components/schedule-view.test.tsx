import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { ListGame, ScheduleResponse } from "../types";
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

const games: ListGame[] = [
  {
    igdb_id: 1,
    name: "Disco Elysium",
    cover_url: "https://images.example/disco-cover.jpg",
    logo_url: "https://images.example/disco-logo.png",
    hero_url: "https://images.example/disco-hero.jpg",
    summary: "",
    genres: [],
    platforms: [],
    release_year: 2019,
    rating: null,
    hltb_status: "resolved",
    hltb_match_name: "Disco Elysium",
    main_story_hours: 20,
    main_extra_hours: null,
    completionist_hours: null,
  },
  {
    igdb_id: 2,
    name: "Outer Wilds",
    cover_url: "https://images.example/outer-wilds-cover.jpg",
    logo_url: "https://images.example/outer-wilds-logo.png",
    hero_url: "https://images.example/outer-wilds-hero.jpg",
    summary: "",
    genres: [],
    platforms: [],
    release_year: 2019,
    rating: null,
    hltb_status: "resolved",
    hltb_match_name: "Outer Wilds",
    main_story_hours: 16,
    main_extra_hours: null,
    completionist_hours: null,
  },
];

describe("ScheduleView", () => {
  test("renders sessions in month calendars instead of the old table layout", () => {
    const view = render(
      <ScheduleView
        schedule={schedule}
        onScheduleChange={() => {}}
        onDownloadIcal={() => {}}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    expect(view.getAllByText(/play sessions/i).length).toBeGreaterThan(0);
    expect(view.queryByRole("table")).toBeNull();
    expect(view.container.querySelector(".schedule-calendar")).toBeTruthy();
    expect(view.getByRole("heading", { name: "March 2026" })).toBeTruthy();
    expect(view.getByRole("heading", { name: "April 2026" })).toBeTruthy();
    expect(
      view.container.querySelectorAll(".schedule-calendar__month"),
    ).toHaveLength(2);
    expect(
      view.container.querySelectorAll(".schedule-calendar__weekday"),
    ).toHaveLength(14);
    expect(
      view.container.querySelectorAll(".schedule-calendar__day"),
    ).toHaveLength(77);
  });

  test("lays sessions out in month calendars with their game cartridges", () => {
    const view = render(
      <ScheduleView
        schedule={schedule}
        games={games}
        onScheduleChange={() => {}}
        onDownloadIcal={() => {}}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    expect(view.container.querySelector(".schedule-calendar")).toBeTruthy();
    expect(view.getByAltText("Disco Elysium logo")).toBeTruthy();
    expect(view.getByAltText("Outer Wilds cover")).toBeTruthy();
    expect(view.getByText("2.5H")).toBeTruthy();
  });

  test("shows the total elapsed days from the first and last session dates", () => {
    const view = render(
      <ScheduleView
        schedule={schedule}
        onScheduleChange={() => {}}
        onDownloadIcal={() => {}}
      />,
    );

    expect(view.getByText(/days to finish/i)).toBeTruthy();
    expect(view.getByText(/3 days/i)).toBeTruthy();
  });

  test("uses a readable date for sessions and handles an empty result", () => {
    const view = render(
      <ScheduleView
        schedule={schedule}
        onScheduleChange={() => {}}
        onDownloadIcal={() => Promise.resolve(true)}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    expect(
      view.container.querySelector(
        ".schedule-calendar__day:not(.schedule-calendar__day--adjacent) time[datetime='2026-03-30']",
      ),
    ).toBeTruthy();
    expect(view.queryByText("2026-03-30")).toBeNull();

    view.rerender(
      <ScheduleView
        schedule={{ sessions: [], total_hours: 0, estimated_end_date: null }}
        onScheduleChange={() => {}}
        onDownloadIcal={() => Promise.resolve(true)}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );
    expect(view.getByText(/no sessions yet/i)).toBeTruthy();
  });

  test("communicates a successful calendar download", async () => {
    const user = userEvent.setup();
    const view = render(
      <ScheduleView
        schedule={schedule}
        onScheduleChange={() => {}}
        onDownloadIcal={() => Promise.resolve(true)}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    await user.click(view.getByRole("button", { name: /download \.ics/i }));
    expect(view.getByRole("button", { name: /downloaded/i })).toBeTruthy();
  });

  test("communicates when the calendar URL is copied", async () => {
    const user = userEvent.setup();
    const view = render(
      <ScheduleView
        schedule={schedule}
        onScheduleChange={() => {}}
        onDownloadIcal={() => Promise.resolve(true)}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    await user.click(view.getByRole("button", { name: /copy calendar url/i }));
    expect(view.getByRole("button", { name: /url copied/i })).toBeTruthy();
  });

  test("moves a focused session by date", async () => {
    const user = userEvent.setup();
    const onScheduleChange = vi.fn();
    const view = render(
      <ScheduleView
        schedule={schedule}
        finishByDate="2026-04-01"
        onScheduleChange={onScheduleChange}
        onDownloadIcal={() => Promise.resolve(true)}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    await user.click(
      view.getByRole("button", { name: /move outer wilds session/i }),
    );
    await user.keyboard("{ArrowRight}");

    expect(onScheduleChange).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_end_date: "2026-04-02" }),
    );
  });

  test("warns when an edited plan extends past the Finish by date", () => {
    const view = render(
      <ScheduleView
        schedule={schedule}
        finishByDate="2026-03-31"
        onScheduleChange={() => {}}
        onDownloadIcal={() => Promise.resolve(true)}
        onCopyCalendarUrl={() => Promise.resolve(true)}
      />,
    );

    expect(view.getByText(/sessions now fall after/i)).toBeTruthy();
  });
});
