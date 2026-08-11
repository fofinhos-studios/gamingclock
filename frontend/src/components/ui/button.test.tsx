import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";

import { Button } from "./button";

describe("Button", () => {
  test("uses semantic colors and keeps its label on one line", () => {
    const view = render(<Button>Generate Schedule</Button>);
    const button = view.getByRole("button", { name: "Generate Schedule" });

    expect(button.className).toContain("whitespace-nowrap");
    expect(button.className).not.toMatch(/(?:bg|text|border)-(?:black|white)/);
  });
});
