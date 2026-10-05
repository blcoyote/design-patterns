import { describe, expect, it } from "vitest";
import { defaultTheme, THEME_STORAGE_KEY, themes } from "../src/theme/themes.ts";
import { themeBootstrapScript, themeBootstrapTags } from "./themeBootstrap.ts";

/** Runs the shipped script against a fake page and returns the `data-theme` it set. */
function run(storage: { getItem: (key: string) => string | null }): string | undefined {
  const dataset: Record<string, string> = {};
  new Function("localStorage", "document", themeBootstrapScript())(storage, {
    documentElement: { dataset },
  });
  return dataset.theme;
}

describe("themeBootstrapScript", () => {
  it("reads the shared storage key", () => {
    const keys: string[] = [];
    run({
      getItem: (key) => {
        keys.push(key);
        return null;
      },
    });
    expect(keys).toEqual([THEME_STORAGE_KEY]);
  });

  it.each(themes.map((t) => t.id))("applies the stored theme %s", (id) => {
    expect(run({ getItem: () => id })).toBe(id);
  });

  it("uses the default theme when nothing valid is stored", () => {
    expect(run({ getItem: () => null })).toBe(defaultTheme);
    expect(run({ getItem: () => "not-a-theme" })).toBe(defaultTheme);
  });

  it("uses the default theme when storage throws", () => {
    expect(
      run({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(defaultTheme);
  });
});

describe("themeBootstrapTags", () => {
  it("injects the script at the top of <head>", () => {
    expect(themeBootstrapTags()).toEqual([
      { tag: "script", children: themeBootstrapScript(), injectTo: "head-prepend" },
    ]);
  });
});
