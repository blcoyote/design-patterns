import type { LayoutPatch } from "./types.ts";

/**
 * Rewrites the numeric layout literals (`x`, `y`, `width` on participants, `bend` on relations)
 * of a pattern/architecture `index.ts` without touching anything else. Pure text in, text out:
 * the dev-server save endpoint reads the file, calls this, formats the result with prettier and
 * writes it back. No Vite, no filesystem, no HTTP in here.
 *
 * It is a small scanner, not a parser. It understands exactly what it needs to find the right
 * literal: string literals (`"`, `'`, and template literals with nested `${}`) and `//` and
 * block comments are blanked out first, so a `[` or `id: "x"` inside a description can never be
 * mistaken for code. (Regex literals are not understood; the definition files do not use them.)
 * Anything it does not recognise throws a descriptive error instead of guessing, and the result
 * is only built once every edit has been located, so a failure never yields a half-patched file.
 *
 * Semantics:
 * - A property whose literal already equals the requested value is left byte-for-byte alone
 *   (so `x: 400.0` stays and applying the file's own values is the identity).
 * - A differing literal is replaced in place (sign and decimals included).
 * - A missing `x`/`y`/`width` is inserted after the last of `x`/`y` (or, with neither, after
 *   `kind`/`label`/`id`); a missing `bend` after `type`/`label` (or `to`/`from`/`id`). The new
 *   line copies the indentation of the property it follows.
 * - `bend: 0` removes the `bend` property (absent already means straight). `width` is never
 *   removed: a width equal to the default is still written, because explicit beats implicit.
 */
export function patchLayout(source: string, patch: LayoutPatch): string {
  const masked = maskSource(source);
  const root = findDefinitionObject(masked);

  const edits: Edit[] = [];
  const areas: Array<{
    key: "participants" | "relations";
    singular: string;
    changes: Record<string, Partial<Record<string, number>>>;
    anchors: readonly string[];
    fields: readonly string[];
  }> = [
    {
      key: "participants",
      singular: "participant",
      changes: patch.participants,
      anchors: PARTICIPANT_ANCHORS,
      fields: PARTICIPANT_FIELDS,
    },
    {
      key: "relations",
      singular: "relation",
      changes: patch.relations,
      anchors: RELATION_ANCHORS,
      fields: RELATION_FIELDS,
    },
  ];

  for (const area of areas) {
    const ids = Object.keys(area.changes);
    if (ids.length === 0) continue;
    const objects = findArrayObjects(source, masked, root, area.key);
    for (const id of ids) {
      const matches = objects.filter((object) => object.id === id);
      if (matches.length === 0) {
        throw new Error(`layout patch: no ${area.singular} with id "${id}" in "${area.key}"`);
      }
      if (matches.length > 1) {
        throw new Error(`layout patch: ${area.singular} id "${id}" appears more than once`);
      }
      const changes = area.changes[id];
      patchObject(source, masked, matches[0], area.singular, id, changes, area, edits);
    }
  }

  return applyEdits(source, edits);
}

const PARTICIPANT_FIELDS = ["x", "y", "width"] as const;
const RELATION_FIELDS = ["bend"] as const;
/** Properties a new `x`/`y`/`width` goes after, in order of preference when x/y are both absent. */
const PARTICIPANT_ANCHORS = ["x", "y"] as const;
const PARTICIPANT_FALLBACK_ANCHORS = [["kind", "label"], ["id"]] as const;
const RELATION_ANCHORS = ["type", "label"] as const;
const RELATION_FALLBACK_ANCHORS = [["to"], ["from"], ["id"]] as const;

const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const IDENTIFIER = /[A-Za-z_$][\w$]*/y;

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** One `key: value` property of an object literal, as offsets into the source. */
interface Property {
  key: string;
  /** Offset of the first character of the key. */
  start: number;
  valueStart: number;
  /** Offset just past the last character of the value (trailing whitespace excluded). */
  valueEnd: number;
  /** Offset of the comma that ends this property, or -1 for the last property without one. */
  comma: number;
}

interface ArrayObject {
  /** The literal `id` of this object, or undefined when it has none / is not a string literal. */
  id: string | undefined;
  open: number;
  close: number;
  properties: Property[];
}

// ---------------------------------------------------------------------------------------
// Masking: blank out comments and string contents so brackets and keys can be found safely.
// ---------------------------------------------------------------------------------------

/**
 * Returns a string of the same length as `source` in which comments and the contents of string
 * literals are replaced by spaces (newlines are kept, so line structure is unchanged). Quote
 * characters stay, so a string is still recognisable as `"      "`. Template literals keep the
 * code inside `${…}`, so nested strings, comments and templates in there are masked in turn.
 */
function maskSource(source: string): string {
  const out = source.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
    }
  };
  const fail = (message: string, at: number): never => {
    const line = source.slice(0, at).split("\n").length;
    throw new Error(`layout patch: ${message} (line ${line})`);
  };

  /** Scans code from `i`; when `inTemplate`, stops at the `}` that closes the `${`. */
  const scanCode = (start: number, inTemplate: boolean): number => {
    let i = start;
    let depth = 0;
    while (i < source.length) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === "/" && next === "/") {
        let end = source.indexOf("\n", i);
        if (end === -1) end = source.length;
        blank(i, end);
        i = end;
      } else if (ch === "/" && next === "*") {
        const end = source.indexOf("*/", i + 2);
        if (end === -1) fail("unterminated block comment", i);
        blank(i, end + 2);
        i = end + 2;
      } else if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < source.length && source[j] !== ch) {
          if (source[j] === "\n") fail("unterminated string literal", i);
          j += source[j] === "\\" ? 2 : 1;
        }
        if (j >= source.length) fail("unterminated string literal", i);
        blank(i + 1, j);
        i = j + 1;
      } else if (ch === "`") {
        i = scanTemplate(i + 1);
      } else if (ch === "{") {
        depth++;
        i++;
      } else if (ch === "}") {
        if (inTemplate && depth === 0) return i;
        depth--;
        i++;
      } else {
        i++;
      }
    }
    if (inTemplate) fail("unterminated template expression", start);
    return i;
  };

  /** Scans a template literal whose opening backtick is at `start - 1`; returns the offset after it. */
  const scanTemplate = (start: number): number => {
    let i = start;
    while (i < source.length) {
      const ch = source[i];
      if (ch === "\\") {
        blank(i, i + 2);
        i += 2;
      } else if (ch === "`") {
        return i + 1;
      } else if (ch === "$" && source[i + 1] === "{") {
        blank(i, i + 2);
        i = scanCode(i + 2, true);
        blank(i, i + 1);
        i++;
      } else {
        blank(i, i + 1);
        i++;
      }
    }
    return fail("unterminated template literal", start);
  };

  scanCode(0, false);
  return out.join("");
}

// ---------------------------------------------------------------------------------------
// Structure: exported object → participants/relations array → element objects → properties.
// ---------------------------------------------------------------------------------------

const OPENERS = "([{";
const CLOSERS = ")]}";

/** Offset of the bracket that closes the one at `open`. Works on masked text. */
function matchBracket(masked: string, open: number): number {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    const ch = masked[i];
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch) && --depth === 0) return i;
  }
  const line = masked.slice(0, open).split("\n").length;
  throw new Error(`layout patch: unbalanced "${masked[open]}" (line ${line})`);
}

/**
 * Splits the bracketed range after `open` into its top-level, comma-separated items.
 * `start`/`end` exclude surrounding whitespace; `comma` is the separator that follows (or -1).
 */
function splitItems(
  masked: string,
  open: number,
  close: number,
): Array<{ start: number; end: number; comma: number }> {
  const items: Array<{ start: number; end: number; comma: number }> = [];
  let itemStart = open + 1;
  let depth = 0;
  const push = (to: number, comma: number) => {
    let start = itemStart;
    let end = to;
    while (start < end && /\s/.test(masked[start])) start++;
    while (end > start && /\s/.test(masked[end - 1])) end--;
    if (start < end) items.push({ start, end, comma });
  };
  for (let i = open + 1; i < close; i++) {
    const ch = masked[i];
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      push(i, i);
      itemStart = i + 1;
    }
  }
  push(close, -1);
  return items;
}

/** Parses `key: value` properties of the object literal at `[open, close]`. */
function parseProperties(source: string, masked: string, open: number, close: number): Property[] {
  const properties: Property[] = [];
  for (const item of splitItems(masked, open, close)) {
    let key: string;
    let after: number;
    const ch = masked[item.start];
    if (ch === '"' || ch === "'") {
      const end = masked.indexOf(ch, item.start + 1);
      if (end === -1 || end >= item.end) continue;
      key = source.slice(item.start + 1, end);
      after = end + 1;
    } else {
      IDENTIFIER.lastIndex = item.start;
      const match = IDENTIFIER.exec(masked);
      if (!match || match.index !== item.start || item.start + match[0].length > item.end) continue;
      key = match[0];
      after = item.start + match[0].length;
    }
    while (after < item.end && /\s/.test(masked[after])) after++;
    // Shorthand properties, methods and spreads have no `key:`; they carry no layout, skip them.
    if (masked[after] !== ":") continue;
    let valueStart = after + 1;
    while (valueStart < item.end && /\s/.test(masked[valueStart])) valueStart++;
    properties.push({
      key,
      start: item.start,
      valueStart,
      valueEnd: item.end,
      comma: item.comma,
    });
  }
  return properties;
}

/** Finds the `{` of the first `export const name[: Type] = {` and returns its [open, close]. */
function findDefinitionObject(masked: string): { open: number; close: number } {
  const match = /\bexport\s+const\s+[A-Za-z_$][\w$]*\s*(?::[^=;]*)?=\s*\{/.exec(masked);
  if (!match) {
    throw new Error("layout patch: no `export const … = { … }` definition found");
  }
  const open = match.index + match[0].length - 1;
  return { open, close: matchBracket(masked, open) };
}

/** The element objects of the top-level `<key>: [ … ]` array of the definition. */
function findArrayObjects(
  source: string,
  masked: string,
  root: { open: number; close: number },
  key: string,
): ArrayObject[] {
  const property = parseProperties(source, masked, root.open, root.close).find(
    (candidate) => candidate.key === key,
  );
  if (!property) {
    throw new Error(`layout patch: no top-level "${key}" property in the exported definition`);
  }
  if (masked[property.valueStart] !== "[") {
    throw new Error(`layout patch: "${key}" is not an array literal`);
  }
  const open = property.valueStart;
  const close = matchBracket(masked, open);
  const objects: ArrayObject[] = [];
  for (const item of splitItems(masked, open, close)) {
    // Spread elements, calls and identifiers are not object literals; they carry no literal layout.
    if (masked[item.start] !== "{" || matchBracket(masked, item.start) !== item.end - 1) continue;
    const properties = parseProperties(source, masked, item.start, item.end - 1);
    objects.push({
      id: readStringLiteral(
        source,
        masked,
        properties.find((p) => p.key === "id"),
      ),
      open: item.start,
      close: item.end - 1,
      properties,
    });
  }
  return objects;
}

/** The text of a plain `"…"` / `'…'` / `` `…` `` property value, or undefined if it is anything else. */
function readStringLiteral(
  source: string,
  masked: string,
  property: Property | undefined,
): string | undefined {
  if (!property) return undefined;
  const quote = masked[property.valueStart];
  if (quote !== '"' && quote !== "'" && quote !== "`") return undefined;
  if (masked[property.valueEnd - 1] !== quote || property.valueEnd - property.valueStart < 2) {
    return undefined;
  }
  return source.slice(property.valueStart + 1, property.valueEnd - 1);
}

// ---------------------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------------------

function patchObject(
  source: string,
  masked: string,
  object: ArrayObject,
  singular: string,
  id: string,
  changes: Partial<Record<string, number>>,
  area: { anchors: readonly string[]; fields: readonly string[] },
  edits: Edit[],
): void {
  const missing: Array<{ key: string; value: number }> = [];
  for (const field of area.fields) {
    const value = changes[field];
    if (value === undefined) continue;
    if (!Number.isFinite(value)) {
      throw new Error(`layout patch: ${singular} "${id}" ${field} must be a finite number`);
    }
    const property = object.properties.find((p) => p.key === field);
    if (!property) {
      // An absent bend already means straight, so asking for 0 changes nothing.
      if (field === "bend" && value === 0) continue;
      missing.push({ key: field, value });
      continue;
    }
    const literal = masked.slice(property.valueStart, property.valueEnd);
    if (!NUMBER_LITERAL.test(literal)) {
      throw new Error(
        `layout patch: ${singular} "${id}" ${field} is not a numeric literal (found \`${source.slice(property.valueStart, property.valueEnd)}\`)`,
      );
    }
    if (Number(literal) === value) continue;
    if (field === "bend" && value === 0) {
      edits.push(removalEdit(source, masked, property));
    } else {
      edits.push({
        start: property.valueStart,
        end: property.valueEnd,
        text: formatNumber(value),
      });
    }
  }
  if (missing.length > 0) {
    edits.push(...insertionEdits(source, masked, object, singular, id, area.anchors, missing));
  }
}

function formatNumber(value: number): string {
  // `String(-0)` is "0", which is what we want in source.
  return String(value);
}

/** Start of the line containing `offset`. */
function lineStartOf(text: string, offset: number): number {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

/** End of the line containing `offset`, before its `\r\n` / `\n` terminator. */
function lineEndOf(text: string, offset: number): number {
  let end = text.indexOf("\n", offset);
  if (end === -1) end = text.length;
  return end > 0 && text[end - 1] === "\r" ? end - 1 : end;
}

function isBlank(text: string): boolean {
  return /^[ \t]*$/.test(text);
}

/** Removes a property: its whole line when it has the line to itself, otherwise just its text. */
function removalEdit(source: string, masked: string, property: Property): Edit {
  const propEnd = property.comma >= 0 ? property.comma + 1 : property.valueEnd;
  const lineStart = lineStartOf(masked, property.start);
  const lineEnd = lineEndOf(masked, propEnd);
  if (isBlank(masked.slice(lineStart, property.start)) && isBlank(masked.slice(propEnd, lineEnd))) {
    // Take the line terminator with it (and any trailing comment, which is part of masked blanks).
    let end = lineEnd;
    if (source[end] === "\r") end++;
    if (source[end] === "\n") end++;
    return { start: lineStart, end, text: "" };
  }
  let start = property.start;
  let end = propEnd;
  if (property.comma >= 0) {
    while (end < lineEnd && /[ \t]/.test(masked[end])) end++;
  } else {
    // Last property on the line with no comma of its own: take the comma that precedes it.
    let back = start;
    while (back > 0 && /\s/.test(masked[back - 1])) back--;
    if (masked[back - 1] === ",") start = back - 1;
  }
  return { start, end, text: "" };
}

/** New `key: value` properties placed after the best anchor property of the object. */
function insertionEdits(
  source: string,
  masked: string,
  object: ArrayObject,
  singular: string,
  id: string,
  anchors: readonly string[],
  missing: Array<{ key: string; value: number }>,
): Edit[] {
  const fallback =
    singular === "participant" ? PARTICIPANT_FALLBACK_ANCHORS : RELATION_FALLBACK_ANCHORS;
  const pick = (names: readonly string[]): Property | undefined =>
    object.properties
      .filter((p) => names.includes(p.key))
      .reduce<Property | undefined>(
        (best, p) => (best === undefined || p.start > best.start ? p : best),
        undefined,
      );
  const anchor = pick(anchors) ?? fallback.map((names) => pick(names)).find((p) => p !== undefined);
  if (!anchor) {
    throw new Error(`layout patch: ${singular} "${id}" has no property to insert after`);
  }

  const props = missing.map(({ key, value }) => `${key}: ${formatNumber(value)}`);
  const lineStart = lineStartOf(masked, anchor.start);
  const lineEnd = lineEndOf(masked, anchor.valueEnd);
  const afterAnchor = anchor.comma >= 0 ? anchor.comma + 1 : anchor.valueEnd;
  const ownLine =
    isBlank(masked.slice(lineStart, anchor.start)) && isBlank(masked.slice(afterAnchor, lineEnd));

  if (!ownLine) {
    // Several properties share a line (e.g. `{ id: "a", x: 1 }`): stay on that line.
    return [{ start: anchor.valueEnd, end: anchor.valueEnd, text: `, ${props.join(", ")}` }];
  }

  const indent = source.slice(lineStart, anchor.start);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = props.map((prop) => `${eol}${indent}${prop}`);
  if (anchor.comma >= 0) {
    // Insert at the end of the anchor's line so a trailing `// comment` stays with the anchor.
    return [{ start: lineEnd, end: lineEnd, text: lines.map((line) => `${line},`).join("") }];
  }
  // The anchor was the last property and has no comma yet: give it one, new lines follow.
  return [
    { start: anchor.valueEnd, end: anchor.valueEnd, text: "," },
    { start: lineEnd, end: lineEnd, text: lines.join(",") },
  ];
}

/** Applies non-overlapping edits; edits at the same offset keep the order they were added in. */
function applyEdits(source: string, edits: Edit[]): string {
  const ordered = edits
    .map((edit, index) => ({ edit, index }))
    .sort((a, b) => a.edit.start - b.edit.start || a.index - b.index)
    .map(({ edit }) => edit);
  let out = "";
  let cursor = 0;
  for (const edit of ordered) {
    if (edit.start < cursor) throw new Error("layout patch: overlapping edits");
    out += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return out + source.slice(cursor);
}
