import { expect, test } from "bun:test";

test("uses semantic color tokens outside the token declarations", async () => {
  const stylesheet = await Bun.file(
    new URL("./index.css", import.meta.url),
  ).text();
  const implementation = stylesheet.slice(stylesheet.indexOf("@layer base"));

  expect(implementation).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i);
});

test("sets the native control color scheme for each theme", async () => {
  const stylesheet = await Bun.file(
    new URL("./index.css", import.meta.url),
  ).text();

  expect(stylesheet).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*dark;/);
  expect(stylesheet).toMatch(
    /:root\[data-theme="light"\]\s*\{[\s\S]*?color-scheme:\s*light;/,
  );
});

test("uses larger shared icons and an accessible animated brand title", async () => {
  const stylesheet = await Bun.file(
    new URL("./index.css", import.meta.url),
  ).text();

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
