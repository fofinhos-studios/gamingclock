import type { RoutableProps } from "preact-router";
import { useState } from "preact/hooks";

import { AvailabilityForm } from "../components/availability-form";
import { GameListView } from "../components/game-list-view";
import { GameSearch } from "../components/game-search";
import { ScheduleView } from "../components/schedule-view";
import {
  Button,
  Card,
  Field,
  Input,
  Rule,
  Section,
  Select,
  Stack,
  Stat,
} from "../components/ui";
import { downloadIcal, generateSchedule } from "../services/api";
import type {
  GameList,
  ListGame,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

export function HomePage(_props: RoutableProps) {
  const [lists, setLists] = useState<GameList[]>([
    { name: "My Games", games: [] },
  ]);
  const [activeListIndex, setActiveListIndex] = useState(0);
  const [availability, setAvailability] = useState<WeeklyAvailability | null>(
    null,
  );
  const [algorithm, setAlgorithm] = useState<ScheduleAlgorithm>("sequential");
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [actionError, setActionError] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );

  const activeList = lists[activeListIndex];
  const allGames = lists.flatMap((list) => list.games);
  const totalAllHours = allGames.reduce(
    (sum, game) => sum + (game.main_story_hours ?? 0),
    0,
  );
  const unresolvedGames = allGames.filter(
    (game) =>
      game.hltb_status === "unresolved" || game.main_story_hours === null,
  );
  const canGenerateSchedule =
    availability !== null &&
    allGames.length > 0 &&
    unresolvedGames.length === 0;

  const addGame = (
    game: ListGame,
    target: { kind: "existing"; index: number } | { kind: "new"; name: string },
  ) => {
    const updated = [...lists];
    if (target.kind === "new") {
      const newName = target.name.trim() || `List ${lists.length + 1}`;
      updated.push({ name: newName, games: [game] });
      setActiveListIndex(updated.length - 1);
    } else {
      updated[target.index] = {
        ...updated[target.index],
        games: [...updated[target.index].games, game],
      };
      setActiveListIndex(target.index);
    }
    setLists(updated);
    setSchedule(null);
    setActionError("");
  };

  const removeGame = (index: number) => {
    const updated = [...lists];
    updated[activeListIndex] = {
      ...updated[activeListIndex],
      games: updated[activeListIndex].games.filter(
        (_, gameIndex) => gameIndex !== index,
      ),
    };
    setLists(updated);
    setSchedule(null);
  };

  const renameList = (name: string) => {
    const updated = [...lists];
    updated[activeListIndex] = { ...updated[activeListIndex], name };
    setLists(updated);
  };

  const addList = () => {
    setLists([...lists, { name: `List ${lists.length + 1}`, games: [] }]);
    setActiveListIndex(lists.length);
  };

  const handleGenerateSchedule = async () => {
    if (!availability || allGames.length === 0 || unresolvedGames.length > 0) {
      return;
    }
    setActionError("");
    try {
      const result = await generateSchedule(
        "All Lists",
        allGames,
        availability,
        algorithm,
        startDate,
      );
      setSchedule(result);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Schedule generation failed",
      );
    }
  };

  const handleDownloadIcal = async () => {
    if (!availability || allGames.length === 0 || unresolvedGames.length > 0) {
      return;
    }
    setActionError("");
    try {
      const blob = await downloadIcal(
        "Gaming Clock Schedule",
        allGames,
        availability,
        algorithm,
        startDate,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "gaming-clock.ics";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "iCal download failed",
      );
    }
  };

  return (
    <div class="page-shell">
      <a href="#planner" class="skip-link">
        Skip to planner
      </a>

      <main id="planner">
        <Section compact class="pb-20 pt-10 md:pb-24 md:pt-16">
          <div class="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-end">
            <Stack gap="lg">
              <p class="section-eyebrow">Gaming backlog planner</p>
              <h1 class="hero-title">Gaming Clock</h1>
              <p class="max-w-2xl text-xl leading-relaxed">
                Plan your gaming backlog and estimate when you will finish it.
              </p>
              <div class="hero-frame">
                <span class="hero-frame__square" />
                <span class="hero-frame__line" />
              </div>
            </Stack>

            <Card
              tone="inverted"
              class="texture-vertical flex h-full flex-col justify-end gap-6"
            >
              <div class="space-y-3">
                <p class="section-eyebrow text-white/70">Workflow</p>
                <p class="text-4xl leading-none md:text-5xl">
                  Search, stack, schedule, export.
                </p>
              </div>
              <p class="text-base leading-relaxed text-white/80">
                Pull HLTB estimates into lists, assign weekly time, and turn the
                result into an iCal-ready play plan.
              </p>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="border-t-2 border-white pt-3">
                  <p class="section-eyebrow text-white/70">Algorithms</p>
                  <p class="mt-2 text-3xl leading-none">2</p>
                </div>
                <div class="border-t-2 border-white pt-3">
                  <p class="section-eyebrow text-white/70">Lists</p>
                  <p class="mt-2 text-3xl leading-none">{lists.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        <Rule />

        <Section
          inverted
          texture="vertical"
          label="Overview"
          title="Backlog at a glance."
          description="Track total playtime, list count, and unresolved HLTB matches before generating a schedule."
          class="border-y-4 border-black"
        >
          <dl class="grid gap-8 md:grid-cols-3">
            <Stat
              label="Total library hours"
              value={totalAllHours.toFixed(1)}
              detail="Across every list in the planner"
              inverted
            />
            <Stat
              label="Titles tracked"
              value={`${allGames.length}`}
              detail="Including unresolved entries"
              inverted
            />
            <Stat
              label="Need HLTB match"
              value={`${unresolvedGames.length}`}
              detail="Resolve these before scheduling"
              inverted
            />
          </dl>
        </Section>

        <Rule />

        <Section
          label="Collections"
          title="Search titles and organize the backlog."
          description="Add games into an existing list or create a new collection on the fly."
          texture="grid"
        >
          <div class="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Card class="p-6 md:p-8">
              <GameSearch
                lists={lists.map((list) => ({ name: list.name }))}
                activeListIndex={activeListIndex}
                onAddGame={addGame}
              />
            </Card>

            <Stack gap="lg">
              <Card tone="muted" class="flex flex-col gap-6">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div class="space-y-2">
                    <p class="section-eyebrow">Lists</p>
                    <h2 class="text-4xl md:text-5xl">Your Lists</h2>
                    <p class="text-[var(--muted-foreground)]">
                      Switch collections, rename the active backlog, and keep
                      total hours in view.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={addList}>
                    New List
                  </Button>
                </div>

                <div class="flex flex-wrap gap-3">
                  {lists.map((list, index) => (
                    <Button
                      type="button"
                      key={`${list.name}-${index}`}
                      size="sm"
                      variant={
                        index === activeListIndex ? "primary" : "outline"
                      }
                      onClick={() => setActiveListIndex(index)}
                      aria-pressed={index === activeListIndex}
                    >
                      {list.name} ({list.games.length})
                    </Button>
                  ))}
                </div>

                <div class="grid gap-4 sm:grid-cols-3">
                  <div class="border-t-2 border-black pt-3">
                    <p class="section-eyebrow">Active list</p>
                    <p class="mt-2 text-2xl leading-none">{activeList.name}</p>
                  </div>
                  <div class="border-t-2 border-black pt-3">
                    <p class="section-eyebrow">Games</p>
                    <p class="mt-2 text-2xl leading-none">{allGames.length}</p>
                  </div>
                  <div class="border-t-2 border-black pt-3">
                    <p class="section-eyebrow">Hours</p>
                    <p class="mt-2 text-2xl leading-none">
                      {totalAllHours.toFixed(1)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card class="p-6 md:p-8">
                <GameListView
                  name={activeList.name}
                  games={activeList.games}
                  onRemoveGame={removeGame}
                  onRenameList={renameList}
                />
              </Card>
            </Stack>
          </div>
        </Section>

        <Rule />

        <Section
          label="Schedule"
          title="Set a realistic play cadence."
          description="Choose when you can play, then generate sessions once every title has a resolved HLTB match."
          texture="diagonal"
        >
          <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
            <Card class="p-6 md:p-8">
              <AvailabilityForm onSubmit={setAvailability} />
            </Card>

            <Card
              tone={availability ? "inverted" : "default"}
              class={`flex flex-col gap-6 ${availability ? "texture-vertical" : ""}`}
            >
              <div class="space-y-3">
                <p
                  class={`section-eyebrow ${availability ? "text-white/70" : ""}`}
                >
                  Generator
                </p>
                <h2 class="text-4xl md:text-5xl">Generate Schedule</h2>
                <p
                  class={
                    availability
                      ? "text-white/80"
                      : "text-[var(--muted-foreground)]"
                  }
                >
                  {availability
                    ? `${availability.days.length} day(s) selected. Choose a start date and scheduling algorithm.`
                    : "Set your weekly availability first, then generate a schedule for every resolved title."}
                </p>
              </div>

              <Field label="Start date" controlId="schedule-start-date">
                <Input
                  id="schedule-start-date"
                  type="date"
                  value={startDate}
                  onInput={(event) =>
                    setStartDate((event.target as HTMLInputElement).value)
                  }
                  class={availability ? "bg-white text-black" : ""}
                />
              </Field>

              <Field label="Algorithm" controlId="schedule-algorithm">
                <Select
                  id="schedule-algorithm"
                  value={algorithm}
                  onChange={(event) =>
                    setAlgorithm(
                      (event.target as HTMLSelectElement)
                        .value as ScheduleAlgorithm,
                    )
                  }
                  class={availability ? "bg-white text-black" : ""}
                >
                  <option value="sequential">Sequential</option>
                  <option value="alternating">Alternating</option>
                </Select>
              </Field>

              {unresolvedGames.length > 0 && (
                <Card tone="default" class="p-4">
                  <p class="section-eyebrow">Resolve before scheduling</p>
                  <p class="mt-3 text-[var(--muted-foreground)]">
                    {unresolvedGames.map((game) => game.name).join(", ")}
                  </p>
                </Card>
              )}

              {actionError && (
                <p class={availability ? "text-white" : "text-black"}>
                  {actionError}
                </p>
              )}

              <Button
                type="button"
                onClick={handleGenerateSchedule}
                disabled={!canGenerateSchedule}
                variant={availability ? "outline" : "primary"}
                class={
                  availability
                    ? "border-white bg-white text-black hover:border-white hover:bg-black hover:text-white"
                    : undefined
                }
              >
                Generate Schedule
              </Button>
            </Card>
          </div>
        </Section>

        {schedule && (
          <>
            <Rule />
            <Section compact class="pt-10 md:pt-14">
              <ScheduleView
                schedule={schedule}
                onDownloadIcal={handleDownloadIcal}
              />
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
