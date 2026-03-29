# AGENTS.md — Frontend

## Scope

These instructions apply to work under `frontend/`.

## Stack

- Runtime/tooling: Bun
- App: Vite + Preact + TypeScript
- Styling: Tailwind CSS (minimal MVP styling)

## Working Rules

- Keep styling minimal and functional. Prefer raw semantic elements with simple Tailwind layout/spacing classes.
- Prioritize behavior and correctness over visual polish.
- Avoid introducing new frameworks or UI component libraries unless explicitly requested.
- Follow DRY and YAGNI; keep implementations small and direct.
- Shared visual primitives belong in `src/components/ui/`; feature components should compose them instead of re-creating one-off control styles.
- Keep design tokens and semantic surface/form classes in `src/index.css` so monochrome styling stays centralized.

## Commands

- Install deps: `bun install`
- Run dev server: `bunx vite`
- Build: `bunx vite build`
- Preview build: `bunx vite preview`

## Testing

- If tests are added, use Bun test runner by default: `bun test`.
- For UI behavior, prefer focused tests near the feature being changed.
- DOM-oriented smoke tests use `bun test --preload ./src/test/setup.ts`.

## File Organization

- `src/components/`: reusable UI pieces
- `src/pages/`: page-level views
- `src/hooks/`: custom hooks
- `src/services/`: API/data access
- `src/app.tsx`, `src/main.tsx`: app wiring and bootstrap

## Change Checklist

- Keep changes scoped to the task.
- Ensure frontend builds successfully before completion.
- Update this file when introducing a new frontend pattern, library, or workflow.
