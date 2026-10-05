import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultTheme, themes } from "../src/theme/themes.ts";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
// Comments hold examples (`[data-theme="light"] { … }`) that must not be parsed as real blocks.
const tokensCss = readFileSync(join(SRC, "theme", "tokens.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const rel = (path: string) => relative(ROOT, path).split(sep).join("/");

// ---------------------------------------------------------------------------------------
// 1. Colour is decided in src/theme and nowhere else.
// ---------------------------------------------------------------------------------------

/** Files whose colour literals are fine: the theme itself, tests, and the teaching content. */
function isExempt(file: string): boolean {
  return (
    file.startsWith("src/theme/") ||
    /\.test\.tsx?$/.test(file) ||
    /(^|\/)example\.[a-z]+$/.test(file) ||
    // A pattern's index.ts is prose and code-as-text (Flyweight quotes "#2f6b3a" as example data).
    /^src\/(patterns|architectures|comparisons)\/(?:[^/]+\/)+index\.ts$/.test(file)
  );
}

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const UTILITIES =
  "bg|text|border|ring|fill|stroke|from|to|via|shadow|divide|outline|accent|decoration|caret|placeholder";

const RAW_COLOUR_RULES: { what: string; pattern: RegExp }[] = [
  // "Order #104" is prose, so a short hex only counts when it is the whole string.
  { what: "6/8-digit hex literal", pattern: /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/ },
  { what: "3/4-digit hex string", pattern: /["'`]#[0-9a-fA-F]{3,4}["'`]/ },
  { what: "rgb()/hsl()/oklch()/… literal", pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/ },
  { what: "color-mix() (use alpha() from src/theme)", pattern: /\bcolor-mix\(/ },
  { what: "Tailwind palette class", pattern: new RegExp(`\\b(?:${UTILITIES})-(?:${PALETTE})\\b`) },
  { what: "arbitrary-value colour class", pattern: /\b[a-z]+-\[#[0-9a-fA-F]+\]/ },
];

const sourceFiles = walk(SRC)
  .map(rel)
  .filter((file) => /\.(tsx?|css)$/.test(file) && !isExempt(file));

describe("colour lives in src/theme", () => {
  it("scans a meaningful number of files", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it.each(RAW_COLOUR_RULES)("no $what outside src/theme", ({ pattern }) => {
    const offenders = sourceFiles.flatMap((file) =>
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}  ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------
// 2. Tokens: every reference resolves, every theme is complete.
// ---------------------------------------------------------------------------------------

/** `--color-*` custom properties declared inside the first `{ … }` that follows `header`. */
function declaredColourTokens(block: string): string[] {
  return [...block.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

/** Body of every `header { … }` block (no nested braces in tokens.css, so a lazy match works). */
function blocksOf(header: RegExp): string[] {
  return [...tokensCss.matchAll(new RegExp(`${header.source}\\s*\\{([^}]*)\\}`, "g"))].map(
    (m) => m[1],
  );
}

const defaultTokens = blocksOf(/@theme static/).flatMap(declaredColourTokens);
const themeBlocks = new Map(
  [...tokensCss.matchAll(/\[data-theme="([^"]+)"\]\s*\{([^}]*)\}/g)].map((m) => [m[1], m[2]]),
);

describe("tokens.css", () => {
  it("declares the default theme's colour tokens", () => {
    expect(defaultTokens.length).toBeGreaterThan(40);
    expect(new Set(defaultTokens).size).toBe(defaultTokens.length); // no token declared twice
  });

  it("every var(--color-…) used in source is a declared token", () => {
    const known = new Set(defaultTokens);
    const unknown = sourceFiles.flatMap((file) =>
      [...readFileSync(join(ROOT, file), "utf8").matchAll(/var\((--color-[a-z0-9-]+)\)/g)]
        .map((m) => m[1])
        .filter((name) => !known.has(name))
        .map((name) => `${file}  ${name}`),
    );
    expect(unknown).toEqual([]);
  });
});

describe("themes", () => {
  const alternates = themes.filter((theme) => theme.id !== defaultTheme);

  it("the default theme is defined by :root, so it has no [data-theme] block", () => {
    expect(themeBlocks.has(defaultTheme)).toBe(false);
  });

  it("every [data-theme] block belongs to a theme listed in themes.ts", () => {
    const listed = new Set<string>(themes.map((theme) => theme.id));
    expect([...themeBlocks.keys()].filter((id) => !listed.has(id))).toEqual([]);
  });

  it.each(alternates.map((theme) => [theme.id] as const))(
    "%s has a [data-theme] block that sets a colour scheme and every colour token",
    (id) => {
      const block = themeBlocks.get(id);
      expect(block, `no [data-theme="${id}"] block in tokens.css`).toBeDefined();
      expect(block).toMatch(/color-scheme\s*:\s*(light|dark)/);
      const defined = new Set(declaredColourTokens(block ?? ""));
      expect(defaultTokens.filter((token) => !defined.has(token))).toEqual([]);
      expect([...defined].filter((token) => !defaultTokens.includes(token))).toEqual([]);
    },
  );
});
