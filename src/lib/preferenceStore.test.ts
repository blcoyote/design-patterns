import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreferenceStore } from "./preferenceStore";

type Mode = "a" | "b" | "c";
const options: readonly Mode[] = ["a", "b", "c"];

function stubBrowser(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const target = new EventTarget();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
  vi.stubGlobal("window", target);
  return {
    data,
    // other tabs write storage, then the browser fires `storage` here
    otherTabWrites(key: string, value: string) {
      data.set(key, value);
      const event = new Event("storage") as Event & { key: string };
      event.key = key;
      target.dispatchEvent(event);
    },
  };
}

describe("createPreferenceStore", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("starts from the stored value when it is a valid option", () => {
    stubBrowser({ k: "b" });
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a" });
    expect(store.getSnapshot()).toBe("b");
  });

  it("falls back when the stored value is not an option", () => {
    stubBrowser({ k: "nope" });
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a" });
    expect(store.getSnapshot()).toBe("a");
  });

  it("falls back when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a" });
    expect(store.getSnapshot()).toBe("a");
    expect(() => store.set("b")).not.toThrow();
    expect(store.getSnapshot()).toBe("b"); // in-memory value still updates
  });

  it("set persists, notifies subscribers and calls onChange once", () => {
    const { data } = stubBrowser();
    const onChange = vi.fn();
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a", onChange });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("c");
    expect(data.get("k")).toBe("c");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("c");
  });

  it("setting the current value is a no-op", () => {
    stubBrowser();
    const onChange = vi.fn();
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a", onChange });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("a");
    expect(listener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("picks up a change written by another tab and stops after unsubscribe", () => {
    const browser = stubBrowser();
    const onChange = vi.fn();
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a", onChange });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    browser.otherTabWrites("k", "b");
    expect(store.getSnapshot()).toBe("b");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("b");

    unsubscribe();
    browser.otherTabWrites("k", "c");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores storage events for other keys", () => {
    const browser = stubBrowser();
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a" });
    const listener = vi.fn();
    store.subscribe(listener);
    browser.otherTabWrites("other", "b");
    expect(listener).not.toHaveBeenCalled();
  });

  it("resyncs with storage when (re)subscribing", () => {
    const browser = stubBrowser();
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a" });
    browser.data.set("k", "c"); // changed while nothing was subscribed
    store.subscribe(() => {});
    expect(store.getSnapshot()).toBe("c");
  });

  it("serves the fallback on the server", () => {
    stubBrowser({ k: "b" });
    const store = createPreferenceStore<Mode>({ key: "k", options, fallback: "a" });
    expect(store.getServerSnapshot()).toBe("a");
  });
});
