# Copilot review and coding instructions

This repo is an interactive teaching site for design patterns (GoF, enterprise) and architectural patterns (React 19, TypeScript, Tailwind v4, Vite). The product is **correct teaching material**: a diagram, step note, description or code comment that disagrees with the code is a bug, as serious as a crash.

When reviewing, spend your attention on the content below before style or naming. `CLAUDE.md` and `README.md` ("Adding a pattern") are the full rules.

## What to check first: content correctness

- **Claims match the code.** `summary`, `intent`, `problem`, `solution`, `pros`, `cons`, participant and relation descriptions, step `description`s and code comments must be literally true of the example code. Flag overclaims (for example a guarantee the pattern does not give) and anything a reader could be misled by.
- **Textbook accuracy.** Role names and intent follow the standard literature (GoF, Fowler, Hohpe & Woolf, Nygard). Language shortcuts (C# events, Python libraries) may be mentioned in a comment but must not replace the pattern.
- **Step notes are reproducible.** Counts, ids, cursors and totals in `notes` must be what running the example actually produces.
- **Packet order follows execution.** Within a step, chain cause to effect with `after` (call then return, hop then next hop). Parallel packets are only for a true broadcast.

## Four languages, one story

Each pattern folder `src/patterns/<category>/<slug>/` has `example.ts`, `example.cs`, `example.py` and `example.go`. They must tell the same story: same roles, scenario, values and printed output, and the **same set of region ids** (`// [id]` ... `// [/id]`, or `# [id]` ... `# [/id]` in Python). Flag any change to one file that is not mirrored in the other three, and any region that does not wrap the code the step text describes, in every language.

Known parity traps:

- C# string interpolation is culture-dependent: use `CultureInfo.InvariantCulture` for machine-readable output.
- C# `Math.Round` rounds half to even; use `MidpointRounding.AwayFromZero` to match JS.
- A Python `set` is unordered; use a `dict` where TS relies on `Set`/`Map` insertion order.
- Python `async def` does not run until awaited, unlike a started JS promise.
- Use counters for ids, not timestamps.
- Live list versus snapshot iteration, and remove-first versus remove-all, must behave the same in all four.
- A comment such as "never overridden" or "upsert" must be literally true in that language.

Layout: TS usage at the bottom; C# usage at the top (top-level statements first); Python imports first and usage at the bottom; Go `package main` with usage in `func main()`.

Description text in `index.ts` must hold for every tab: name all four mechanisms or use neutral wording.

## Structure rules

- Patterns are data: `index.ts` is a pure `PatternDefinition`. The registry auto-discovers folders, so never hand-register a pattern or special-case a slug in shared components.
- Shared behaviour belongs in `src/components`, `src/hooks` or `src/lib`, not in a pattern folder.
- Cross-references: only architectures declare `commonlyUsedWith`; pattern-to-architecture links are derived. Architecture-to-architecture links must be declared on both sides. `related` slugs must exist.
- Colour lives only in `src/theme/tokens.css`. Use token utilities (`bg-surface`, `text-fg-muted`), `"var(--color-...)"` in code and `alpha(color, pct)` for transparency. Flag any hex, `rgb()` or Tailwind palette class outside `src/theme/`.
- Do not bypass the type checker: no `as unknown as T`, `any`, `@ts-ignore` or `@ts-expect-error` to silence an error. Fix the type contract or narrow with a runtime check.
- Diagram scenes animate packets through the shared timing (`packetSpeed`, `PacketLayer`, `after`), never hand-rolled delays.

## Verification the author should have run

`npm test`, `npx tsc -b`, `npm run lint`, every `example.py` with `python3 -W error`, every `example.go` with `go run`, and any touched C# file compiled and run. Ask for the results if a PR changes examples and does not report them.

## Review style

Prefer a few comments that point at a concrete wrong claim, a mismatch between tabs, or a behaviour the code does not have. Skip nitpicks on wording that is correct.
