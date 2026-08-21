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

  test("keeps the primary border aligned with its hover surface", () => {
    const view = render(<Button variant="primary">Continue</Button>);
    const button = view.getByRole("button", { name: "Continue" });

    expect(button.className).toContain(
      "hover:border-[var(--muted-foreground)]",
    );
  });
});
