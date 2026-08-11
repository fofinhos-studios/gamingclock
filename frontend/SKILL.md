# Frontend SKILL.md

## Project

- **Framework**: Preact (lightweight React alternative)
- **Bundler**: Vite
- **Styling**: Tailwind CSS (minimal for MVP — raw elements, layout only)
- **Package manager**: Bun
- **Linter**: biome
- **Routing**: preact-router

## How to run

```bash
cd frontend
bun install
bun run dev
```

## How to build

```bash
cd frontend
bun run build
```

## How to lint

```bash
cd frontend
bunx @biomejs/biome check src/
bunx @biomejs/biome check --write src/
```

## Dependency Management

```bash
cd frontend
bun update
bun audit
```

- Commit `bun.lock` whenever frontend dependencies change.
- Run `bun audit` locally; CI rejects known vulnerabilities.

## API and Pages

- `src/services/api.ts` is the single place for backend HTTP calls.
- `src/pages/home.tsx` owns the dense planner app shell, active workflow step, multiple local backlogs, availability, scheduling, and generated schedule/error state.
- `src/components/` holds raw-element MVP UI pieces for search, lists, availability, and schedule display.

## Planner Flow And Boundaries

- `src/components/planner-games-step.tsx`, `src/components/planner-availability-step.tsx`, and `src/components/planner-schedule-step.tsx` split the page into focused planner steps.
- `src/components/planner-tabs.tsx` is the workflow rail and owns the selected-step interaction behavior.
- `src/components/planner-summary.tsx` is the compact top status strip that summarizes backlog, availability, and schedule state.
- The MVP keeps a collection of local backlogs in `src/pages/home.tsx`; the selected backlog flows into the step components while the toolbar reports total games and resolved hours across all backlogs.

## Calendar Flow

- Schedule generation uses `generateSchedule()` and renders `ScheduleView`.
- `.ics` export uses `downloadIcal()` and triggers a browser download from the returned blob.

## Search And Resolution Flow

- `src/components/game-search.tsx` performs debounced catalogue autocomplete after 2 typed characters and resolves HLTB playtime only after a selected game is added through `POST /games/resolve`.
- `src/services/api.ts` rejects unresolved HLTB responses in `resolveGame()`, so games without usable HLTB data stay out of the backlog and surface an inline search error instead.
- `src/pages/home.tsx` stores one backlog of resolved games, sums the active HLTB category, and gates schedule generation only on having games plus saved availability.
- `src/services/api.ts` is the single integration boundary for `searchGames()`, `resolveGame()`, `generateSchedule()`, and `downloadIcal()`.

## HLTB time selection

- **Read**: `src/components/game-list-view.tsx` renders available main, extras, and completionist estimates as pressed buttons. `src/types.ts` contains `getSelectedGameHours()` for the shared main-by-default fallback.
- **Edit**: New games must be added with `selected_hltb_category: "main"`. Update the selection through `PlannerGamesStep` and `HomePage` so summary totals and schedule requests stay synchronized; do not display IGDB platforms or the HLTB match attribution on backlog cards.
- **Test**: `bun test --preload ./src/test/setup.ts src/pages/home.test.tsx -t "lets each backlog game activate"` verifies default activation, metadata removal, totals, and the schedule payload.

## Dense Planner UI System

- **Design tokens**: `src/index.css` owns the dense planner shell, Space Grotesk + JetBrains Mono font pairing, control sizing, pane/layout classes, and shared semantic classes such as `.planner-pane`, `.planner-statusbar`, `.planner-rail__tab`, `.ui-input`, and `.timeline`.
- **Reusable primitives**: `src/components/ui/` contains the shared building blocks for buttons, cards, fields, inputs, selects, rules, sections, stacks, and stats.
- **Read**: Start with `src/pages/home.tsx` for page composition, then follow the primitives in `src/components/ui/`, then inspect the feature components for how they consume those primitives.
- **Edit**: Prefer extending planner classes or shared primitives before adding one-off utility strings. Keep the app behavior stable first, then tune density and spacing through `src/index.css`.

## Availability And Interaction Feedback

- `src/components/availability-form.tsx` owns both weekly hours and `start_hour`, using the same uniform/custom card pattern and per-day overrides for each.
- `src/hooks/use-transient-feedback.ts` is the shared transient state helper for click confirmation across buttons, tabs, cards, and other interactive planner surfaces.
- `src/index.css` provides the visual feedback layer for those states through classes like `.ui-button[data-feedback]`, `.planner-choice--confirmed`, `.planner-result--success`, and `.planner-rail__tab--confirmed`.
- **Test**: `src/pages/home.test.tsx` covers the start-hour request payload and the HLTB error flow from search through schedule readiness.

## Frontend Smoke Tests

- **Libraries**: `@testing-library/preact` with `@happy-dom/global-registrator`, executed through Bun.
- **Setup**: `src/test/setup.ts` registers the DOM environment and cleanup hooks.
- **Read**: `src/pages/home.test.tsx` covers the page shell/accessibility baseline and `src/components/schedule-view.test.tsx` covers the timeline schedule presentation.
- **Test**: `bun test --preload ./src/test/setup.ts` or `bun run test`

## Conventions

- Use `.tsx` for all component files
- Functional components only, use Preact hooks
- API calls go in `src/services/`
- Shared types go in `src/types.ts`
- Pages (routed views) go in `src/pages/`
- Reusable components go in `src/components/`
- Shared visual primitives live in `src/components/ui/`
