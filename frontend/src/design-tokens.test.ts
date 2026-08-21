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
    /\.planner-pane\s*\{[^}]*?background:\s*var\(--muted\);/,
  );
  expect(stylesheet).toMatch(
    /\.planner-empty-state\s*\{[^}]*?background:\s*var\(--surface-hover\);/,
  );
});

test("uses larger shared icons and an accessible animated brand title", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-icon\s*\{[\s\S]*?width:\s*1\.15rem;[\s\S]*?height:\s*1\.15rem;/,
  );
  expect(stylesheet).toMatch(
    /\.planner-brand__title\s*\{[\s\S]*?animation:\s*planner-title-shimmer[\s\S]*?planner-title-wave/,
  );
  expect(stylesheet).toMatch(/@keyframes planner-title-shimmer/);
  expect(stylesheet).toMatch(/@keyframes planner-title-wave/);
  expect(stylesheet).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.planner-brand__title\s*\{[\s\S]*?animation:\s*none;/,
  );
});

test("keeps touch controls large and disables motion when requested", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.theme-toggle\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /\.planner-toolbar__backlogs button\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /\.ui-input,[\s\S]*?\.ui-select\s*\{[\s\S]*?min-height:\s*2\.75rem;/,
  );
  expect(stylesheet).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation-duration:\s*0\.01ms !important;[\s\S]*?transition-duration:\s*0\.01ms !important;/,
  );
});
