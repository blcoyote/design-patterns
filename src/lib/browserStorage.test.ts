import { afterEach, describe, expect, it, vi } from "vitest";
import { browserStorage } from "./browserStorage";

afterEach(() => vi.unstubAllGlobals());

describe("browserStorage", () => {
  it("ignores a global localStorage when there is no window (Node 25+)", () => {
    const getter = vi.fn(() => ({}));
    vi.stubGlobal("window", undefined);
    const restore = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: getter });
    try {
      expect(browserStorage()).toBeNull();
      expect(getter).not.toHaveBeenCalled();
    } finally {
      if (restore) Object.defineProperty(globalThis, "localStorage", restore);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it("returns window.localStorage in a browser", () => {
    const store = { getItem: () => null } as Partial<Storage>;
    vi.stubGlobal("window", { localStorage: store });
    expect(browserStorage()).toBe(store);
  });

  it("returns null when accessing window.localStorage throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(browserStorage()).toBeNull();
  });
});
