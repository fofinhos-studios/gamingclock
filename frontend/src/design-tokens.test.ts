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

test("uses the locked industrial palette and type pairing", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(/--iron-core:\s*#222a2a/i);
  expect(stylesheet).toMatch(/--industrial-aqua:\s*#4fbbbc/i);
  expect(stylesheet).toMatch(/--rust-signal:\s*#ec4624/i);
  expect(stylesheet).toMatch(/--heat-marker:\s*#f39120/i);
  expect(stylesheet).toMatch(/--architectural-cream:\s*#e2dac2/i);
  expect(stylesheet).toMatch(/--font-display:\s*"DotGothic16"/);
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

test("builds the workspace from inset metal, glass, and brushed material layers", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(/--panel-glass:\s*var\(--surface-\d+\);/);
  expect(stylesheet).toMatch(/--brushed-metal:/);
  expect(stylesheet).toMatch(
    /\.planner-app__workspace\s*\{[\s\S]*?box-shadow:\s*[\s\S]*?inset/,
  );
  expect(stylesheet).toMatch(
    /\.planner-pane\s*\{[\s\S]*?backdrop-filter:\s*blur\(/,
  );
  expect(stylesheet).toMatch(
    /\.ui-input,[\s\S]*?\.ui-select\s*\{[\s\S]*?box-shadow:\s*inset/,
  );
});

test("lays out schedule guidance and plan facts as deliberate responsive groups", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-algorithm-explanations\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  expect(stylesheet).toMatch(
    /\.planner-schedule-preview\s*\{[\s\S]*?border-left:\s*2px solid var\(--step-active\);/,
  );
  expect(stylesheet).toMatch(
    /\.planner-preview-list\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
  );
  expect(stylesheet).toMatch(
    /@media \(max-width: 767px\)\s*\{[\s\S]*?\.planner-algorithm-explanations,[\s\S]*?\.planner-preview-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
});

test("keeps the planner in its single-column layout until there is room for its control panel", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.planner-app__workspace\s*\{[\s\S]*?grid-template-columns:\s*14rem minmax\(0,\s*1fr\);/,
  );
  expect(stylesheet).toMatch(
    /@media \(max-width: 1279px\)\s*\{[\s\S]*?\.planner-algorithm-explanations,[\s\S]*?\.planner-preview-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
});

test("does not leave a detached frame around the desktop stepper", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.planner-stepper\s*\{[\s\S]*?border-right:\s*0;/,
  );
  expect(stylesheet).toMatch(
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.planner-stepper__list\s*\{[\s\S]*?border-bottom:\s*0;/,
  );
});

test("uses larger shared icons without the retired brand styling", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-icon\s*\{[\s\S]*?width:\s*1\.15rem;[\s\S]*?height:\s*1\.15rem;/,
  );
  expect(stylesheet).not.toMatch(/\.planner-brand(?:__|\s|\{)/);
  expect(stylesheet).not.toMatch(/@keyframes planner-title-/);
});

test("keeps touch controls large and disables motion when requested", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.theme-toggle\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /\.backlog-manager__actions \.ui-button\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /\.ui-input,[\s\S]*?\.ui-select\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation-duration:\s*0\.01ms !important;[\s\S]*?transition-duration:\s*0\.01ms !important;/,
  );
});

test("keeps buttons stationary on hover", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.ui-button:hover\s*\{[\s\S]*?box-shadow:\s*0 0\.35rem 1rem var\(--foreground-08\);/,
  );
  expect(stylesheet).not.toMatch(
    /\.ui-button:hover\s*\{[^}]*?transform:\s*translateY\(/,
  );
});
