import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const frontendPath = process.cwd();
const iconConsumers = [
  "src/components/availability-form.tsx",
  "src/components/backlog-manager.tsx",
  "src/components/game-list-view.tsx",
  "src/components/game-search.tsx",
  "src/components/planner-availability-step.tsx",
  "src/components/planner-schedule-step.tsx",
  "src/components/planner-step-actions.tsx",
  "src/components/planner-tabs.tsx",
  "src/components/schedule-view.tsx",
  "src/pages/home.tsx",
];

test("uses Phosphor as the sole UI icon library", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(frontendPath, "package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  const consumers = await Promise.all(
    iconConsumers.map((path) => readFile(resolve(frontendPath, path), "utf8")),
  );

  expect(packageJson.dependencies["@phosphor-icons/react"]).toBeDefined();
  expect(packageJson.dependencies["lucide-preact"]).toBeUndefined();
  expect(consumers.join("\n")).not.toContain("lucide-preact");
  expect(consumers.join("\n")).toContain("@phosphor-icons/react");
});
