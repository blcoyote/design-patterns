# CLAUDE.md

## Purpose

An interactive, animated teaching site for the 23 Gang of Four patterns plus 7 enterprise patterns, and a separate Architecture area with 6 architectural patterns (DDD, Hexagonal, CQRS, …) cross-linked to them (React 19 + TypeScript + Tailwind v4, Vite, hash routing, static deploy to GitHub Pages).

The product is **correct teaching material**. A diagram, a step note or a code comment that disagrees with the code is a bug, just as much as a crash. Every pattern must be:

- **Correct**: the code compiles, runs, and does exactly what its comments, step notes and descriptions claim.
- **Consistent**: the TypeScript, C# and Python examples tell the same story: same roles, same scenario, same values, same output.
- **Honest about the pattern**: GoF role names and intent are the textbook ones. Language-specific shortcuts (C# events, Python `blinker`, etc.) are mentioned in a comment, not substituted for the pattern.

## The paved path

Follow these every time. If a task seems to need a different route, stop and ask first.

### 1. Patterns are data, not code paths

- One folder per pattern: `src/patterns/<category>/<slug>/` with `index.ts` (pure `PatternDefinition` data), `example.ts`, `example.cs`, `example.py`, and optionally `Visualization.tsx`.
- The registry auto-discovers folders. Never hand-register a pattern, and never special-case a slug in shared components.
- New patterns start from `src/patterns/_template/` (see README → "Adding a pattern").
- Shared behaviour goes in `src/components`, `src/hooks` or `src/lib`, never inside a pattern folder.
- Architectures follow the same rules in `src/architectures/<paradigm>/<slug>/` (`ArchitectureDefinition`, template in `src/architectures/_template/`). Only architectures declare cross-references (`commonlyUsedWith`); design-pattern → architecture links are derived in `src/lib/crossRefs.ts`, and architecture ↔ architecture links must be declared on both sides (`npm test` enforces this).

### 2. Three languages, one set of regions

- `example.ts` → `code`, `example.cs` → `csharp`, `example.py` → `python`, all imported with `?raw`.
- Region markers go on their own lines: `// [id]` … `// [/id]` in TS/C#, `# [id]` … `# [/id]` in Python. Every file must use **exactly the same set of region ids** (`npm test` enforces this).
- Steps, participants and relations point at region ids. Check that each region wraps the code that the step's text describes, in **all three** files.
- Layout conventions:
  - **TS:** usage goes at the bottom.
  - **C#:** usage goes at the top, because top-level statements must come before type declarations.
  - **Python:** imports first, usage at the bottom, `asyncio.run(main())` when TS uses `await`.
- When you change one example, change the other two in the same task. Never leave the tabs out of step.
- Description text in `index.ts` must hold for every tab. If it names a mechanism, name all three (e.g. Memento: WeakMap / private nested class / WeakKeyDictionary) or use neutral wording.

### 3. Known parity traps (each one has already bitten us)

- **Number formatting:** C# interpolation uses the current culture (`2,5` on da-DK). Use `CultureInfo.InvariantCulture` / `FormattableString.Invariant` for anything that is supposed to be machine-readable.
- **Rounding:** C# `Math.Round` uses banker's rounding. Use `MidpointRounding.AwayFromZero` to match JS `Math.round`.
- **Ordering:** JS `Set`/`Map` keep insertion order. A Python `set` does not, so use a `dict` instead.
- **Eagerness:** JS promises start immediately, but Python `async def` doesn't run until awaited. Keep methods synchronous where TS does work before its first `await`.
- **IDs:** use counters, not timestamps.
- **Collection semantics:** remove-first vs remove-all, iterating a live list vs a snapshot. Keep them identical across languages.
- **Comments:** a comment claiming something ("upsert", "never overridden", "cursor: 0") must be literally true in that language. Example: in C#, a method marked `virtual` can be overridden.
- **Step notes:** values in `notes` (counts, cursors, totals) must be reproducible by running the example.

### 4. Verify before you call it done

Run all of these. Report the actual results, including failures:

```bash
npm test                     # registry validation, marker/region parity
npx tsc -b                   # type-check
npm run lint
for f in src/patterns/*/*/example.py src/architectures/*/*/example.py; do PYTHONDONTWRITEBYTECODE=1 python3 -W error "$f" >/dev/null || echo "FAIL $f"; done
```

- Compile and run any C# file you touched (e.g. copy it into a scratch `dotnet new console` project as `Program.cs`). Check the output matches the comments.
- For TS examples you touched, type-check the file on its own (`npx tsc --ignoreConfig --strict --noEmit --moduleDetection force --target es2022 --module esnext --lib es2022,dom <file>`), since `example.ts` files are excluded from the app tsconfig.
- For UI changes, check in the browser preview: the `dev-alt` config in `.claude/launch.json` runs on port 5180. Click through the steps and tabs.

### 5. Working style

- Make minimal, focused edits that match the surrounding code's style and comment density.
- Work on a feature branch. Commit or open a PR only when asked.
- Large, parallel work (e.g. porting all 30 patterns) is split across subagents by pattern folder. Each subagent owns its folders exclusively and gets a written brief with these rules. Review their output yourself before reporting: re-run everything in step 4 and read the code.
- Keep the README ("Adding a pattern", project structure) up to date when the workflow changes.
