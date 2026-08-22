import { render, waitFor } from "@testing-library/preact";
import { h } from "preact";
import { expect, test, vi } from "vitest";

const liquidGlass = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@ybouane/liquidglass", () => ({ LiquidGlass: liquidGlass }));

import { SurfaceWordmark } from "./surface-wordmark";

test("initializes and disposes the glass effect within the wordmark", async () => {
  const glassInstance = { destroy: vi.fn() };
  liquidGlass.init.mockResolvedValue(glassInstance);

  const view = render(h(SurfaceWordmark, {}));
  const wordmark = view.getByRole("img", { name: "Gaming Clock" });
  const glassSurface = view.container.querySelector(".planner-identity__glass");

  await waitFor(() => expect(liquidGlass.init).toHaveBeenCalledOnce());
  expect(liquidGlass.init).toHaveBeenCalledWith(
    expect.objectContaining({
      root: wordmark,
      glassElements: [glassSurface],
    }),
  );

  view.unmount();
  expect(glassInstance.destroy).toHaveBeenCalledOnce();
});
