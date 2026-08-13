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

test("uses spacious, prominent stepper connectors", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-stepper__connector\s*\{[\s\S]*?min-height:\s*3\.25rem;/,
  );
  expect(stylesheet).toMatch(
    /\.planner-stepper__connector \.planner-icon\s*\{[\s\S]*?width:\s*1\.5rem;[\s\S]*?height:\s*1\.5rem;/,
  );
});

test("frames inactive planner stages with a subtle border", async () => {
  const stylesheet = await readStylesheet();

  expect(stylesheet).toMatch(
    /\.planner-stepper__tab\s*\{[^}]*?border:\s*1px solid var\(--foreground-16\);/,
  );
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
