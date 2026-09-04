import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const stylesheetPath = resolve(process.cwd(), "src/index.css");

async function readStylesheet() {
  return readFile(stylesheetPath, "utf8");
}

test("uses semantic color tokens outside the token declarations", async () => {
  const stylesheet = await readStylesheet();
  const implementation = stylesheet.slice(stylesheet.indexOf("@layer base"));

  expect(implementation).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i);
});

test("sets the native control color scheme for each theme", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*dark;/);
  expect(stylesheet).toMatch(
    /:root\[data-theme="light"\]\s*\{[\s\S]*?color-scheme:\s*light;/,
  );
});

test("gives native select options an explicit themed surface", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /select option\s*\{[\s\S]*?background:\s*var\(--surface\);[\s\S]*?color:\s*var\(--foreground\);/,
  );
});

test("uses the high-contrast graphite palette and type pairing", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(/--iron-core:\s*#171612/i);
  expect(stylesheet).toMatch(/--industrial-aqua:\s*#78cbc1/i);
  expect(stylesheet).toMatch(/--rust-signal:\s*#f0704f/i);
  expect(stylesheet).toMatch(/--heat-marker:\s*#e7a952/i);
  expect(stylesheet).toMatch(/--architectural-cream:\s*#f3ede0/i);
  expect(stylesheet).toMatch(/--muted-foreground:\s*#c9c2b5/i);
  expect(stylesheet).toMatch(/--font-display:\s*"DM Sans"/);
  expect(stylesheet).toMatch(/--font-body:\s*"Space Mono"/);
});

test("uses a compact horizontal stage navigation instead of a sidebar", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-stepper__list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/,
  );
  expect(stylesheet).not.toMatch(/"sidebar main"/);
  expect(stylesheet).toMatch(/\.planner-step-actions\s*\{/);
});

test("uses distinct raised surfaces for planner panes and empty states", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-pane\s*\{[\s\S]*?background:\s*linear-gradient\(/,
  );
  expect(stylesheet).toMatch(
    /\.planner-empty-state\s*\{[^}]*?background:\s*var\(--surface-hover\);/,
  );
});

test("builds the workspace from inset metal and solid planner surfaces", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(/--panel-glass:\s*var\(--surface-\d+\);/);
  expect(stylesheet).toMatch(/--canvas-texture:/);
  expect(stylesheet).toMatch(
    /\.planner-app__workspace\s*\{[\s\S]*?box-shadow:\s*[\s\S]*?inset/,
  );
  expect(stylesheet).toMatch(
    /\.planner-pane\s*\{[\s\S]*?background:\s*var\(--surface\);/,
  );
  expect(stylesheet).not.toMatch(
    /\.planner-pane\s*\{[\s\S]*?backdrop-filter:\s*blur\(/,
  );
  expect(stylesheet).toMatch(
    /\.ui-input,[\s\S]*?\.ui-select\s*\{[\s\S]*?box-shadow:\s*inset/,
  );
});

test("keeps schedule guidance in the method hint and plan facts in a responsive group", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).not.toMatch(/\.planner-algorithm-explanations\s*\{/);
  expect(stylesheet).toMatch(
    /\.planner-schedule-preview\s*\{[\s\S]*?border-left:\s*2px solid var\(--step-active\);/,
  );
  expect(stylesheet).toMatch(
    /\.planner-preview-list\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
  );
  expect(stylesheet).toMatch(
    /@media \(max-width: 767px\)\s*\{[\s\S]*?\.planner-preview-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
});

test("keeps the planner in its single-column layout until there is room for its control panel", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.planner-app__workspace\s*\{[\s\S]*?grid-template-columns:\s*14rem minmax\(0,\s*1fr\);/,
  );
  expect(stylesheet).toMatch(
    /@media \(max-width: 1279px\)\s*\{[\s\S]*?\.planner-preview-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
});

test("lets the toolbar reflow without viewport-specific breakpoints", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-toolbar__topline\s*\{[\s\S]*?flex-wrap:\s*wrap;/,
  );
  expect(stylesheet).toMatch(
    /\.planner-toolbar__controls\s*\{[\s\S]*?flex:\s*1 1 50%;[\s\S]*?flex-wrap:\s*wrap;/,
  );
  expect(stylesheet).toMatch(
    /\.planner-identity\s*\{[\s\S]*?font-size:\s*clamp\(1rem,\s*4vw,\s*2\.2rem\);/,
  );
  expect(stylesheet).not.toMatch(/@media \(max-width: (1535|959|599)px\)/);
});

test("keeps the open backlog panel above the search dock", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.backlog-manager__panel\s*\{[\s\S]*?z-index:\s*3;/,
  );
  expect(stylesheet).toMatch(/\.planner-search-dock\s*\{[\s\S]*?z-index:\s*2;/);
});

test("uses the browser default type scale", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(/html\s*\{[\s\S]*?font-size:\s*100%;/);
});

test("uses a contained desktop stepper with clearly separated controls", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.planner-stepper\s*\{[\s\S]*?border:\s*1px solid var\(--foreground-16\);[\s\S]*?background:\s*[\s\S]*?var\(--panel-chassis\);/,
  );
  expect(stylesheet).toMatch(
    /\.planner-stepper__tab\s*\{[\s\S]*?border:\s*1px solid var\(--foreground-16\);[\s\S]*?border-bottom:\s*2px solid var\(--foreground-32\);/,
  );
});

test("uses larger shared icons and an embossed IntraNet wordmark", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-icon\s*\{[\s\S]*?width:\s*1\.15rem;[\s\S]*?height:\s*1\.15rem;/,
  );
  expect(stylesheet).toMatch(
    /@font-face\s*\{[\s\S]*?font-family:\s*"IntraNet";[\s\S]*?IntraNet-Bold\.otf/,
  );
  expect(stylesheet).toMatch(
    /@font-face\s*\{[\s\S]*?font-family:\s*"IntraNet";[\s\S]*?font-display:\s*block;/,
  );
  expect(stylesheet).toMatch(/--font-brand:\s*"IntraNet",\s*sans-serif;/);
  expect(stylesheet).toMatch(
    /\.planner-identity\s*\{[\s\S]*?font-family:\s*var\(--font-brand\);/,
  );
  expect(stylesheet).toMatch(/\.planner-identity__label\s*\{/);
  expect(stylesheet).not.toMatch(/\.planner-brand(?:__|\s|\{)/);
  expect(stylesheet).not.toMatch(/\.planner-identity__glass\s*\{/);
  expect(stylesheet).not.toMatch(/@keyframes planner-title-/);
});

test("keeps touch controls large and disables motion when requested", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.theme-toggle\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /\.ui-input,[\s\S]*?\.ui-select\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation-duration:\s*0\.01ms !important;[\s\S]*?transition-duration:\s*0\.01ms !important;/,
  );
});

test("keeps buttons stationary and beveled through hover and press", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.ui-button:hover\s*\{[\s\S]*?box-shadow:\s*inset 1px 1px 0 var\(--foreground-16\),[\s\S]*?inset -1px -1px 0 var\(--foreground-04\),[\s\S]*?0 0\.35rem 1rem var\(--foreground-08\);/,
  );
  expect(stylesheet).toMatch(
    /\.ui-button:active\s*\{[\s\S]*?box-shadow:\s*inset 1px 1px 0 var\(--foreground-04\),[\s\S]*?inset -1px -1px 0 var\(--foreground-12\),/,
  );
  expect(stylesheet).not.toMatch(
    /\.ui-button:hover\s*\{[^}]*?transform:\s*translateY\(/,
  );
});

test("uses the aqua accent instead of foreground-colored interaction outlines", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /button:focus-visible,[\s\S]*?outline:\s*2px solid var\(--industrial-aqua\);/,
  );
  expect(stylesheet).not.toMatch(
    /\.planner-backlog-row:hover\s*\{[^}]*?border-color:\s*var\(--foreground-85\);/,
  );
});
