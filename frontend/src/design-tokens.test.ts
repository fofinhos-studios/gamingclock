import { expect, test } from "bun:test";

test("uses semantic color tokens outside the token declarations", async () => {
  const stylesheet = await Bun.file(
    new URL("./index.css", import.meta.url),
  ).text();
  const tokenBlockStart = stylesheet.indexOf(":root");
  const implementation = stylesheet.slice(
    stylesheet.indexOf("}", tokenBlockStart) + 1,
  );

  expect(implementation).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i);
});
