# Dense Planner UI Polish Design

## Context

The current planner flow is functionally correct but visually behaves more like a styled content page than a usable planning tool. The main problems are oversized typography, excessive vertical padding, unstable tab feedback, cramped working areas, and poor use of horizontal space for the actual planning tasks.

The next pass should optimize for UX first: make the app feel like software, not a landing page. Functionality stays primary. Layout and styling should support scanning, editing, and navigating quickly.

## Goals

- Make the planner feel like a proper application workspace
- Reduce oversized typography and vertical bulk
- Prioritize usable space for search results, backlog management, availability, and schedule controls
- Fix unstable tab interaction and selected/hover feedback
- Preserve the current single-backlog flow and scheduling behavior
- Keep the monochrome technical feel while shifting away from editorial serif presentation

## Non-Goals

- Adding new product features
- Reintroducing multi-list support in this pass
- Reworking backend behavior
- Preserving the current visual hierarchy if it hurts usability

## Product Direction

This pass should bias toward dense, usable application UI rather than visual flourish.

- Functionality and feature usability come first
- Layout decisions should optimize working space, not decorative composition
- Explanatory copy should be shorter and secondary to controls
- Desktop usage is the primary target, while mobile remains functional

## Typography Direction

The app should stop using large Playfair-driven display treatment as the primary visual voice.

- `JetBrains Mono` remains the control and data font:
  - tabs / step navigation
  - buttons
  - inputs
  - compact status items
  - chips
  - metadata rows
- A neutral sans-serif should replace serif usage for descriptive text and labels
- Heading sizes should be reduced significantly
- Large editorial title styling should be removed from the home page

## Layout Direction

### Overall Shell

The page should open almost directly into content.

- Keep only a very small title bar or utility header
- Remove the feeling of a framed hero or centered marketing card
- Make the app feel like a dense planning workspace

### Desktop Structure

Use a tool-like application layout:

- left side: a narrow workflow rail with `Games`, `Availability`, and `Schedule`
- main area: active workspace for the selected step
- top of the main area: compact status strip rather than a sidebar summary

The status strip should sit at the top of the workspace and scroll away normally.

### Status Strip

Replace the current right summary sidebar with a compact horizontal status row.

It should show:

- backlog name
- tracked games
- resolved hours
- unresolved count
- availability state
- schedule state

If a schedule exists, it should also show:

- total planned hours
- total sessions
- estimated finish
- total elapsed days

This row should be dense, readable, and compact rather than card-heavy.

## Step Navigation

The current tabs should evolve into a denser workflow control with stable visual feedback.

Requirements:

- the selected step must remain visually selected after click
- hovering the selected step must not make it appear inactive
- inactive hover feedback must not compete with selected state
- click behavior must remain stable and predictable
- keyboard tab behavior from the current accessible implementation must remain intact

The visual feel should be closer to a tool rail or segmented app navigation than decorative buttons.

## Games Step

This step should become the primary workspace and receive the most horizontal space.

### Desktop Layout

Use a side-by-side full-width arrangement:

- left pane: search workspace
- right pane: backlog workspace

Both panes should feel like real working panels rather than oversized cards.

### Search Pane

The search pane should become denser and easier to scan.

- smaller heading
- shorter search input
- tighter spacing above and below the control
- results dropdown/list should consume more usable area and less decorative padding
- result items should compress:
  - smaller covers
  - smaller titles
  - tighter metadata
  - less summary text dominance

The dropdown should feel like a searchable game picker, not a series of oversized feature cards.

### Backlog Pane

The backlog pane should maximize room for the game list.

- smaller backlog heading and copy
- tighter row spacing
- smaller artwork and metadata blocks
- less wasted whitespace around controls

The goal is to see and manage more entries at once.

## Availability Step

The availability screen should follow the same dense tool pattern.

- smaller titles
- tighter mode cards / toggles
- denser day selection grid
- explanatory text kept brief and secondary

It should feel like a settings panel, not a full-page feature section.

## Schedule Step

The schedule screen should also be more tool-like.

- compact control block for algorithm and start date
- prerequisite guidance stays close to the disabled action
- generated output remains readable but should avoid oversized headline treatment

The schedule output and summary metrics should remain functionally unchanged unless needed for better density and clarity.

## Interaction Rules

- Step navigation remains reversible
- Single backlog remains the active model
- Existing schedule invalidation rules stay intact:
  - changing games, availability, start date, or algorithm clears stale generated schedules
- Schedule generation is still blocked by prerequisites, not locked navigation

## Implementation Preference

The user explicitly requested a one-shot refactor approach for implementation.

- Perform the interface/layout refactor broadly first
- Leave verification and test execution for the end of the refactor pass
- This preference applies to execution style for this UI pass even though the broader project usually follows TDD

## Testing Impact

Keep the current functional coverage where it still applies, but update expectations to fit the denser UI.

Important coverage areas:

- active step selection remains stable after click
- selected step hover styling does not visually conflict with selected state
- keyboard navigation across the workflow control still works
- schedule prerequisite messaging remains accessible
- schedule invalidation behavior still works
- generated schedule metrics still render correctly

If DOM structure changes significantly, tests should follow behavior and accessibility semantics rather than old layout details.

## File Targets

This pass will likely center on:

- `frontend/src/pages/home.tsx`
- `frontend/src/index.css`
- `frontend/src/components/planner-tabs.tsx`
- `frontend/src/components/planner-summary.tsx`
- `frontend/src/components/planner-games-step.tsx`
- `frontend/src/components/game-search.tsx`
- `frontend/src/components/game-list-view.tsx`
- `frontend/src/components/planner-availability-step.tsx`
- `frontend/src/components/planner-schedule-step.tsx`
- related frontend tests

## Success Criteria

The redesign is successful if:

- the planner feels immediately usable as an app
- the Games step has materially more working room
- typography no longer dominates the interface
- tab selection and hover behavior are visually stable
- the UI reads as a compact planning tool rather than a styled landing page
