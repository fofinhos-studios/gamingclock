import { cleanup } from "@testing-library/preact";
import { afterEach } from "vitest";

import { clearGameRequestCache } from "../services/api";

const storageValues = new Map<string, string>();
const storage: Storage = {
  get length() {
    return storageValues.size;
  },
  clear: () => storageValues.clear(),
  getItem: (key) => storageValues.get(key) ?? null,
  key: (index) => [...storageValues.keys()][index] ?? null,
  removeItem: (key) => storageValues.delete(key),
  setItem: (key, value) => storageValues.set(key, value),
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

afterEach(() => {
  cleanup();
  clearGameRequestCache();
  window.localStorage.clear();
});
