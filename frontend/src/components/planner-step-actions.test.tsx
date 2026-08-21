import { render } from "@testing-library/preact";
import { describe, expect, test, vi } from "vitest";

import { LanguageProvider } from "../i18n/i18n";
import { PlannerStepActions } from "./planner-step-actions";

describe("PlannerStepActions", () => {
  test("uses the same outlined chassis for back and continue navigation", () => {
    const view = render(
      <LanguageProvider browserLanguages={["en"]}>
        <PlannerStepActions
          activeTab="availability"
          canContinue
          onChange={vi.fn()}
        />
      </LanguageProvider>,
    );

    for (const button of view.getAllByRole("button")) {
      expect(button.className).toContain("border-[var(--foreground)]");
      expect(button.className).toContain("bg-[var(--surface)]");
      expect(button.className).not.toContain("border-transparent");
    }
  });
});
