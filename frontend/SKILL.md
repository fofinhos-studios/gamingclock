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

## API and Pages

- `src/services/api.ts` is the single place for backend HTTP calls.
- `src/pages/home.tsx` owns the centered planner shell, the active tab, the single backlog state, availability, scheduling, and the generated schedule/error state.
- `src/components/` holds raw-element MVP UI pieces for search, lists, availability, and schedule display.

## Planner Flow And Boundaries

- `src/components/planner-games-step.tsx`, `src/components/planner-availability-step.tsx`, and `src/components/planner-schedule-step.tsx` split the page into focused planner steps.
- `src/components/planner-tabs.tsx` keeps the accessible tab strip, and `src/components/planner-summary.tsx` keeps the always-visible status column.
- The MVP assumes one backlog only. Future multi-list support should re-enter in `src/pages/home.tsx` by lifting the backlog into a collection-level container while keeping the step component props backlog-shaped.

## Calendar Flow

- Schedule generation uses `generateSchedule()` and renders `ScheduleView`.
- `.ics` export uses `downloadIcal()` and triggers a browser download from the returned blob.

## Search And Resolution Flow

- `src/components/game-search.tsx` performs debounced IGDB autocomplete after 2 typed characters and resolves a selected game through `POST /games/resolve`.
- `src/pages/home.tsx` stores resolved and unresolved backlog items, sums only resolved HLTB hours, and blocks schedule generation while unresolved games remain.
- `src/services/api.ts` is the single integration boundary for `searchGames()`, `resolveGame()`, `generateSchedule()`, and `downloadIcal()`.

## Minimalist Monochrome UI System

- **Design tokens**: `src/index.css` now owns the monochrome palette, font imports, typography scale, textures, sharp-corner reset, and shared semantic classes such as `.section-eyebrow`, `.surface-card`, `.ui-input`, and `.timeline`.
- **Reusable primitives**: `src/components/ui/` contains the shared building blocks for buttons, cards, fields, inputs, selects, rules, sections, stacks, and stats.
- **Read**: Start with `src/pages/home.tsx` for page composition, then follow the primitives in `src/components/ui/`, then inspect the feature components for how they consume those primitives.
- **Edit**: Prefer extending tokens or primitives before adding one-off utility strings to feature components. Keep the monochrome rules intact: no radius, no shadows, no accent colors.

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
