import { expect, test, vi } from "vitest";

import {
  fitWordmarkFontSize,
  prepareTransparentShaderSurface,
} from "./surface-wordmark";

test("scales a wide IntraNet wordmark to fit its shader canvas", () => {
  expect(
    fitWordmarkFontSize({
      preferredSize: 54,
      measuredWidth: 498,
      maximumWidth: 276,
    }),
  ).toBeCloseTo(29.93, 2);
});

test("clears the wordmark canvas transparently before shading", () => {
  const context = {
    BLEND: 3042,
    COLOR_BUFFER_BIT: 16384,
    ONE_MINUS_SRC_ALPHA: 771,
    SRC_ALPHA: 770,
    blendFunc: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
  };

  prepareTransparentShaderSurface(context);

  expect(context.clearColor).toHaveBeenCalledWith(0, 0, 0, 0);
  expect(context.clear).toHaveBeenCalledWith(context.COLOR_BUFFER_BIT);
  expect(context.enable).toHaveBeenCalledWith(context.BLEND);
  expect(context.blendFunc).toHaveBeenCalledWith(
    context.SRC_ALPHA,
    context.ONE_MINUS_SRC_ALPHA,
  );
});
