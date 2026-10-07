# CLAUDE.md

## Purpose

An interactive, animated teaching site for the 23 Gang of Four patterns plus 11 enterprise patterns, and a separate Architecture area with 12 architectural patterns (DDD, Hexagonal, CQRS, …) cross-linked to them (React 19 + TypeScript + Tailwind v4, Vite, hash routing, static deploy to GitHub Pages).

The product is **correct teaching material**. A diagram, a step note or a code comment that disagrees with the code is a bug, just as much as a crash. Every pattern must be:

- **Correct**: the code compiles, runs, and does exactly what its comments, step notes and descriptions claim.
- **Consistent**: the TypeScript, C#, Python and Go examples tell the same story: same roles, same scenario, same values, same output.
- **Honest about the pattern**: GoF role names and intent are the textbook ones. Language-specific shortcuts (C# events, Python `blinker`, etc.) are mentioned in a comment, not substituted for the pattern.

## The paved path

Follow these every time. If a task seems to need a different route, stop and ask first.

### 1. Patterns are data, not code paths

- One folder per pattern: `src/patterns/<category>/<slug>/` with `index.ts` (pure `PatternDefinition` data), `example.ts`, `example.cs`, `example.py`, `example.go`, and optionally `Visualization.tsx`.
- The registry auto-discovers folders. Never hand-register a pattern, and never special-case a slug in shared components.
- New patterns start from `src/patterns/_template/` (see README → "Adding a pattern").
- Shared behaviour goes in `src/components`, `src/hooks` or `src/lib`, never inside a pattern folder.
- Colour is decided in `src/theme/tokens.css` and nowhere else. Use semantic token utilities in classNames (`bg-surface`, `text-fg-muted`, `fill-diagram-node`), `"var(--color-…)"` for values computed in code, and `alpha(color, pct)` for transparency (never `${color}22`). No hex, `rgb()` or Tailwind palette classes outside `src/theme/`; `npm test` enforces it (the only exemption is standalone image assets such as `public/favicon.svg`, listed in the guardrail test). If a role has no token, add one rather than a literal. A theme is a `[data-theme]` block plus a `themes.ts` entry (README → "Theming").
- Architectures follow the same rules in `src/architectures/<paradigm>/<slug>/` (`ArchitectureDefinition`, template in `src/architectures/_template/`). Only architectures declare cross-references (`commonlyUsedWith`); design-pattern → architecture links are derived in `src/lib/crossRefs.ts`, and architecture ↔ architecture links must be declared on both sides (`npm test` enforces this).
- Comparisons (`src/comparisons/<slug>/`, `ComparisonDefinition`, template in `src/comparisons/_template/`) follow the same data/registry rules, one level deep (no category/paradigm folder). A comparison has no code or diagram of its own — it only references region ids and step indices that already exist on the patterns/architectures it compares, resolved through `crossRefs.ts`'s `resolveSubject` so `comparisons/registry.ts` never imports either registry directly.
- When this site's own code uses a pattern it teaches, tag the usage with `// @pattern <slug>: <explanation>` directly above the code (see "Used in this site" in the README) instead of listing files anywhere.

### 2. Four languages, one set of regions

- `example.ts` → `code`, `example.cs` → `csharp`, `example.py` → `python`, `example.go` → `go`, all imported with `?raw`.
- Region markers go on their own lines: `// [id]` … `// [/id]` in TS/C#/Go, `# [id]` … `# [/id]` in Python. Every file must use **exactly the same set of region ids** (`npm test` enforces this).
- Steps, participants and relations point at region ids. Check that each region wraps the code that the step's text describes, in **all four** files.
- Layout conventions:
  - **TS:** usage goes at the bottom.
  - **C#:** usage goes at the top, because top-level statements must come before type declarations.
  - **Python:** imports first, usage at the bottom, `asyncio.run(main())` when TS uses `await`.
  - **Go:** package declaration first, usage in `func main()` at the bottom.
- When you change one example, change the other three in the same task. Never leave the tabs out of step.
- Description text in `index.ts` must hold for every tab. If it names a mechanism, name all four (e.g. Memento: WeakMap / private nested class / WeakKeyDictionary / unexported field) or use neutral wording.

### 3. Known parity traps (each one has already bitten us)

- **Number formatting:** C# interpolation uses the current culture (`2,5` on da-DK). Use `CultureInfo.InvariantCulture` / `FormattableString.Invariant` for anything that is supposed to be machine-readable.
- **Rounding:** C# `Math.Round` uses banker's rounding. Use `MidpointRounding.AwayFromZero` to match JS `Math.round`.
- **Ordering:** JS `Set`/`Map` keep insertion order. A Python `set` does not, so use a `dict` instead.
- **Eagerness:** JS promises start immediately, but Python `async def` doesn't run until awaited. Keep methods synchronous where TS does work before its first `await`.
- **IDs:** use counters, not timestamps.
- **Collection semantics:** remove-first vs remove-all, iterating a live list vs a snapshot. Keep them identical across languages.
- **Comments:** a comment claiming something ("upsert", "never overridden", "cursor: 0") must be literally true in that language. Example: in C#, a method marked `virtual` can be overridden.
- **Step notes:** values in `notes` (counts, cursors, totals) must be reproducible by running the example.
- **Animation order:** packets in a step play in the order the code runs. Chain cause → effect with `after` (call → return, hop → next hop); leave packets parallel only for a true broadcast. Custom scenes use `Diagram`'s `packetSpeed={speed}` or `PacketLayer`, never hand-rolled packet delays. See README → "Animating steps".

### 4. Verify before you call it done

Run all of these. Report the actual results, including failures:

```bash
npm test                     # registry validation, marker/region parity
npx tsc -b                   # type-check
npm run lint
for f in src/patterns/*/*/example.py src/architectures/*/*/example.py; do PYTHONDONTWRITEBYTECODE=1 python3 -W error "$f" >/dev/null || echo "FAIL $f"; done
for f in src/patterns/*/*/example.go src/architectures/*/*/example.go; do go run "$f" >/dev/null || echo "FAIL $f"; done
```

- Compile and run any C# file you touched (e.g. copy it into a scratch `dotnet new console` project as `Program.cs`). Check the output matches the comments.
- For TS examples you touched, type-check the file on its own (`npx tsc --ignoreConfig --strict --noEmit --moduleDetection force --target es2022 --module esnext --lib es2022,dom <file>`), since `example.ts` files are excluded from the app tsconfig.
- For UI changes, check in the browser preview: the `dev-alt` config in `.claude/launch.json` runs on port 5180. Click through the steps and tabs.
- Shut down every dev server you started (`preview_stop`) as soon as you're done with it, so a stale server doesn't hold the port for the next session or agent.

### 5. Working style

- Make minimal, focused edits that match the surrounding code's style and comment density.
- Work on a feature branch. Commit or open a PR only when asked.
- Large, parallel work (e.g. porting all 30 patterns) is split across subagents by pattern folder. Each subagent owns its folders exclusively and gets a written brief with these rules. Review their output yourself before reporting: re-run everything in step 4 and read the code.
- Keep the README ("Adding a pattern", project structure) up to date when the workflow changes.

### 6. Beads issue tracking

- Before selecting tracked work, run `bd ready`; claim the issue you take with `bd update <id> --claim` and inspect its details with `bd show <id>`.
- Respect blocking dependencies. Use `bd dep tree <id>` to understand them; add dependencies when one issue must wait for another.
- Create issues for meaningful follow-up work discovered during a task, rather than silently expanding scope. Use `bd create` with a clear title and relevant description, and link it with `bd dep add` when appropriate.
- Close an issue with `bd close <id>` only after its work and applicable verification are complete. Do not close unrelated issues.
- Beads uses Dolt for storage and team sync. Pull or push with `bd dolt pull` / `bd dolt push` when collaboration requires it; do not treat JSONL export as sync.
