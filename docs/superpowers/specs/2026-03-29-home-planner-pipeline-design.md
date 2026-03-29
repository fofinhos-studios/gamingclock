# Home Planner Pipeline Design

## Context

The current home page behaves like a landing page plus planner. It includes hero and overview sections above the actual workflow, and it exposes multi-list management that is heavier than the current product needs.

The revised direction is to make the app itself the homepage: one centered planner screen, no dashboard-style intro sections, and a clearer step-by-step flow for building a backlog, setting availability, and generating a schedule.

## Goals

- Remove the landing-page sections and keep the page focused on the planner
- Reframe the planner as a manual three-step pipeline with tabs
- Simplify the UI to a single backlog for now
- Preserve state boundaries so multi-list support can return later without rewriting the whole page
- Keep the existing search, availability, scheduling, and `.ics` export capabilities

## Non-Goals

- Reintroducing multi-list UI in this change
- Adding new backend behavior
- Converting the flow into a locked wizard
- Adding visual polish beyond what is needed to support the new layout

## Decisions

### Page Structure

The homepage becomes a centered planner shell rather than a marketing-style page.

- Remove the current hero, workflow, algorithm, and overview sections
- Add a compact header inside the planner shell with the app title and a short supporting sentence
- Render three manual tabs across the top of the planner:
  - `Games`
  - `Availability`
  - `Schedule`
- Below the tabs, show a single active panel for the selected step
- Keep a compact summary panel visible alongside the active panel on desktop
- Stack the layout vertically on smaller screens

### Navigation Model

The flow is pipeline-oriented but not locked.

- Tabs are always clickable
- The app never auto-advances to the next step
- Users can move back to previous tabs at any time to add more games or change availability
- Readiness is communicated through inline messages and summary status, not disabled navigation

### Scope Simplification

The UI moves from multiple lists to one backlog.

- Replace `lists` and `activeListIndex` page state with a single backlog object
- Keep the backlog model separate enough that future multi-list support can wrap the same step components with a collection-level container
- Remove list switching and new-list creation from the page

## Component Design

### Home Page Shell

`frontend/src/pages/home.tsx` remains the route and page-level state owner.

It should own:

- `activeTab`
- `backlogName`
- `games`
- `availability`
- `algorithm`
- `startDate`
- `schedule`
- `actionError`

It is also responsible for:

- deciding which step panel is visible
- computing derived summary metrics
- blocking schedule generation when prerequisites are missing
- clearing stale schedules when games or availability change
- handling `.ics` export

### Step Components

The current page should be decomposed into smaller planner-step components instead of remaining as one large file.

Suggested components:

- `planner-games-step.tsx`
- `planner-availability-step.tsx`
- `planner-schedule-step.tsx`
- optional shared `planner-summary.tsx`
- optional shared `planner-tabs.tsx`

These components should stay presentational where possible, with page-owned business state passed in via props.

### Reuse of Existing Components

Existing feature components should be preserved where they still fit:

- `GameSearch` remains the search and resolve entry point, but its API should be simplified to add directly into the single backlog
- `GameListView` already maps closely to the new single-backlog model and should remain the editable backlog view
- `AvailabilityForm` remains a submit-driven form that writes `WeeklyAvailability`
- `ScheduleView` remains the renderer for generated sessions and `.ics` download access

## Data Flow

### Games Step

The `Games` tab should combine:

- search and add flow
- current backlog view
- editable backlog name

When a game is added or removed:

- update `games`
- clear any existing `schedule`
- clear `actionError`

### Availability Step

The `Availability` tab should center on weekly time setup.

When availability is saved:

- update `availability`
- clear any existing `schedule`
- clear `actionError`

The step remains usable even if the backlog is empty, but it should explain that games are needed before a schedule can be generated.

### Schedule Step

The `Schedule` tab should surface both actions and outcomes.

It should include:

- scheduling algorithm selection
- start date input
- generate action
- inline prerequisite messaging
- rendered schedule output once available

The tab should explain why generation is unavailable when:

- there are no games
- unresolved HLTB matches remain
- availability has not been set

Once a schedule exists, the step should show:

- total hours
- total sessions
- estimated finish date
- total elapsed days from start to finish, derived from the first and last scheduled session dates when available

## Summary Panel

The summary panel should stay visible across all tabs and provide quick status without recreating the removed dashboard sections.

It should show:

- backlog name
- total resolved hours
- number of tracked games
- unresolved game count
- availability status
- schedule status

If a schedule exists, it should also show:

- total planned hours
- total sessions
- estimated finish date
- total elapsed days

## Error Handling

Async action failures remain page-owned through `actionError`.

- Show the error near the active step rather than far below the fold
- Clear stale errors when a fresh successful action completes
- Avoid duplicating error state inside step components unless a component has its own local interaction concern

## Testing Strategy

Follow TDD for implementation.

Initial test coverage should include:

- home page renders the planner shell with tabs and accessible main landmark
- removed landing-page copy is no longer present
- tabs switch visible step content manually
- schedule guidance appears when prerequisites are missing
- schedule metrics render once schedule data exists

If extracted planner step components gain meaningful logic, they should receive focused tests instead of pushing everything into a single page test.

## Future Multi-List Expansion

This change deliberately removes multi-list UI, but the structure should not make that expensive to reintroduce later.

The future path should be:

- replace page-owned single backlog state with a collection of backlog objects
- keep planner step components reusable by supplying the active backlog as props
- restore target selection inside `GameSearch` only when the product needs multiple backlogs again

## Implementation Notes

- Keep styling minimal and centered
- Do not rebuild feature behavior that already works
- Prefer narrowing component APIs over broad abstractions
- Preserve current backend contracts and frontend service calls
