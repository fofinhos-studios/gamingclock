import { readFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  test("uses semantic colors and keeps its label on one line", () => {
    const view = render(<Button>Generate Schedule</Button>);
    const button = view.getByRole("button", { name: "Generate Schedule" });

    expect(button.className).toContain("whitespace-nowrap");
    expect(button.className).not.toMatch(/(?:bg|text|border)-(?:black|white)/);
  });

  test("uses the aqua accent for button hover borders", () => {
    const view = render(<Button variant="primary">Continue</Button>);
    const button = view.getByRole("button", { name: "Continue" });

    expect(button.className).toContain("hover:border-[var(--industrial-aqua)]");
  });

  test("uses the aqua accent for outlined button hover borders", () => {
    const view = render(<Button variant="outline">Back</Button>);
    const button = view.getByRole("button", { name: "Back" });

    expect(button.className).toContain("hover:border-[var(--industrial-aqua)]");
  });

  test("offers an unstyled escape hatch for specialized selection controls", () => {
    const view = render(<Button unstyled>Choose game</Button>);
    const button = view.getByRole("button", { name: "Choose game" });

    expect(button.className).toContain("ui-button--unstyled");
    expect(button.className).not.toContain("border-[var(--foreground)]");
  });

  test("is the shared primitive for every application button", async () => {
    const buttonConsumers = [
      "src/pages/home.tsx",
      "src/components/backlog-manager.tsx",
      "src/components/game-list-view.tsx",
      "src/components/game-search.tsx",
      "src/components/planner-schedule-step.tsx",
      "src/components/planner-tabs.tsx",
    ];

    const sources = await Promise.all(
      buttonConsumers.map((file) =>
        readFile(path.join(process.cwd(), file), "utf8"),
      ),
    );

    for (const source of sources) {
      expect(source).not.toContain("<button");
    }
  });
});
