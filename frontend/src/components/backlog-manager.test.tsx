import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { useState } from "preact/hooks";
import { describe, expect, test } from "vitest";

import type { GameList } from "../types";
import { BacklogManager } from "./backlog-manager";

function BacklogManagerHarness() {
  const [backlogs, setBacklogs] = useState<GameList[]>([
    { id: "my-backlog", name: "My Backlog", games: [] },
    { id: "weekend-games", name: "Weekend Games", games: [] },
  ]);
  const [activeBacklogId, setActiveBacklogId] = useState("my-backlog");

  return (
    <BacklogManager
      backlogs={backlogs}
      activeBacklogId={activeBacklogId}
      onSelect={setActiveBacklogId}
      onCreate={(name) => {
        const id = name.toLowerCase().replace(/\s+/g, "-");
        setBacklogs((current) => [...current, { id, name, games: [] }]);
        setActiveBacklogId(id);
      }}
      onDelete={(id) => {
        setBacklogs((current) =>
          current.filter((backlog) => backlog.id !== id),
        );
        setActiveBacklogId("my-backlog");
      }}
    />
  );
}

describe("BacklogManager", () => {
  test("keeps backlog selection, creation, and deletion in one manageable collection", async () => {
    const user = userEvent.setup();
    const view = render(<BacklogManagerHarness />);

    expect(view.getByText("My Backlog")).toBeTruthy();
    expect(view.getByText("2 backlogs")).toBeTruthy();

    await user.click(view.getByRole("button", { name: /manage backlogs/i }));
    expect(view.getByText("2 backlogs")).toBeTruthy();
    await user.click(
      view.getByRole("button", { name: /weekend games, 0 games, 0\.0 hours/i }),
    );

    expect(
      view.container.querySelector(".backlog-manager__current-name")
        ?.textContent,
    ).toBe("Weekend Games");

    await user.clear(view.getByLabelText(/new backlog name/i));
    await user.type(view.getByLabelText(/new backlog name/i), "Co-op queue");
    await user.click(view.getByRole("button", { name: /create backlog/i }));

    expect(view.getByText("3 backlogs")).toBeTruthy();
    expect(
      view.getByRole("button", { name: /co-op queue, 0 games, 0\.0 hours/i }),
    ).toBeTruthy();

    await user.click(
      view.getByRole("button", { name: /delete weekend games/i }),
    );

    expect(
      view.queryByRole("button", { name: /weekend games, 0 games/i }),
    ).toBeNull();
    expect(view.getByText("2 backlogs")).toBeTruthy();
  });

  test("protects the final backlog from deletion", async () => {
    const user = userEvent.setup();
    const view = render(
      <BacklogManager
        backlogs={[{ id: "my-backlog", name: "My Backlog", games: [] }]}
        activeBacklogId="my-backlog"
        onSelect={() => undefined}
        onCreate={() => undefined}
        onDelete={() => undefined}
      />,
    );

    await user.click(view.getByRole("button", { name: /manage backlogs/i }));

    expect(
      view.getByRole("button", { name: /delete my backlog/i }),
    ).toHaveProperty("disabled", true);
    expect(
      view.getByText(/create another backlog before deleting this one/i),
    ).toBeTruthy();
  });
});
