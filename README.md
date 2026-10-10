# design-patterns

An interactive, animated guide to all 23 Gang of Four design patterns plus 11 common enterprise patterns, and a second
area covering 12 software **architectures**, built with **React + TypeScript + Tailwind CSS v4** (Vite).

Every pattern and architecture has:

- an **animated diagram** — press play and watch messages travel between objects (or layers, or services), step by step
- **clickable parts** — click any class or arrow to see its role, its connections, and the exact lines of code that implement it
- TypeScript, C#, Python and Go examples, problem/solution/analogy, when to use it, pros & cons, real-world uses and related patterns

| Creational                                                      | Structural                                                      | Behavioral                                                                                                                      | Enterprise                                                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Singleton, Factory Method, Builder, Abstract Factory, Prototype | Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight | Observer, Strategy, Command, Iterator, State, Template Method, Chain of Responsibility, Mediator, Memento, Visitor, Interpreter | Dependency Injection, Repository, Unit of Work, Pub/Sub, Circuit Breaker, Null Object, Object Pool, Plugin, Cache-Aside |

Separately, **Architecture** (`/architecture`) covers Layered, Hexagonal, MVC, Vertical Slice, Domain-Driven Design, CQRS,
Microservices, Event-Driven, Event Sourcing, Functional Core / Imperative Shell, Pipes and Filters and Model-View-Update — see [Architecture](#architecture) below.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm test         # validates every pattern definition
npm run lint
```

The build uses relative paths and hash routing, so `dist/` can be served from any static host (GitHub Pages, S3, …).

### Deployment

- `.github/workflows/ci.yml` runs on every pull request (or manually): lint, type-check, tests and a production build, with `dist/` uploaded as an artifact.
- `.github/workflows/deploy.yml` runs on pushes to `main` (or manually): lint, tests, build, then deploys `dist/` to GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### Issue tracking (beads)

Issues are tracked with [beads](https://github.com/steveyegge/beads) (`bd`), stored in a local Dolt database under `.beads/embeddeddolt/` (git-ignored) and synced through this repository's GitHub remote, in the `refs/dolt/data` ref. The `__dolt_remote_info__` branch is Dolt's own marker, so leave it alone.

```bash
bd bootstrap --yes   # new clone or workstation: clone the issue database from GitHub
bd dolt pull         # start of a session: fetch issues changed elsewhere
bd dolt push         # after creating, updating or closing issues
```

`scripts/beads-setup.sh` does all of this idempotently (installs `bd` if missing, bootstraps, pulls). The Claude `SessionStart` hook (`.claude/hooks/session-start.sh`) runs it in local and cloud sessions; a cloud environment setup script can also call `bash scripts/beads-setup.sh`.

Never run `bd init` in a clone that has no database yet. It creates a history unrelated to the remote's, and `bd dolt pull` / `push` will then refuse to sync.

## Project structure

```
src/
  types/pattern.ts           # ExplorableDefinition (shared) + PatternDefinition
  types/architecture.ts      # ArchitectureDefinition (extends ExplorableDefinition)
  patterns/
    registry.ts              # auto-discovers every src/patterns/*/*/index.ts
    categories.ts            # category labels + colours
    validate.ts              # validateDiagram (shared) + validatePattern
    <category>/<slug>/index.ts          # one folder per pattern, grouped by category (pure data)
    <category>/<slug>/example.ts/.cs/.py/.go # code samples, imported with ?raw
    <category>/<slug>/Visualization.tsx # optional custom animated scene
    _template/               # copy me to add a pattern (ignored by the registry)
  architectures/
    registry.ts              # auto-discovers every src/architectures/*/*/index.ts
    paradigms.ts             # paradigm labels + colours (oo / functional / both)
    validate.ts              # validateDiagram (shared) + validateArchitecture
    <paradigm>/<slug>/index.ts          # one folder per architecture, grouped by paradigm (pure data)
    <paradigm>/<slug>/example.ts/.cs/.py/.go # code samples, same convention as patterns
    <paradigm>/<slug>/Visualization.tsx # optional custom animated scene
    _template/               # copy me to add an architecture (ignored by the registry)
  comparisons/
    registry.ts              # auto-discovers every src/comparisons/*/index.ts (one level deep)
    validate.ts              # validateComparison — takes a subject resolver, never imports a registry
    <slug>/index.ts          # one folder per comparison; no example.ts/.cs/.py of its own
    _template/               # copy me to add a comparison (ignored by the registry)
  components/
    viz/                     # Diagram, DiagramNode, DiagramEdge, Packet, StepPlayer, DetailPanel, PatternExplorer
    content/CrossReferenceBox.tsx # "commonly used with" links between patterns and architectures
    content/ComparisonTeaser.tsx # "often confused with…" links from a pattern/architecture to a comparison
    content/ScenarioQuiz.tsx # the "which should I choose?" quiz at the end of a comparison
    viz/DiagramEditContext.tsx # dev-only: lets <Diagram> draw layout-editor handles (inert without a provider)
    viz/EditHandles.tsx      # the drag / bend / width handles and lint outlines drawn inside a <Diagram>
    pages/ layout/ content/
    pages/dev/               # dev-only layout editor: index + editor page, toolbar, lint panel, change list
  theme/
    tokens.css               # every colour decision: primitives, semantic roles, accents, one block per theme
    themes.ts                # the list of themes (id + label) and the localStorage key
    alpha.ts                 # alpha(color, pct) -> color-mix(); replaces `${color}22` hex-suffix tricks
    codeTheme.ts             # the Prism theme for code blocks, read from --color-code-* / --color-syntax-*
    applyTheme.ts            # sets data-theme on <html> and syncs <meta name="theme-color">
  hooks/useTheme.ts          # active theme, persisted; initTheme() runs once at startup
  hooks/useLayoutHistory.ts  # undo/redo stack of the layout editor (one drag = one step)
  lib/preferenceStore.ts     # localStorage-backed preference shared via useSyncExternalStore (code language, theme)
  lib/codeRegions.ts         # `// [id]` … `// [/id]` code region markers
  lib/crossRefs.ts           # the only module importing both registries — see "Architecture" below
  lib/layoutEdit.ts          # layout overrides: apply, diff, snap, inverse bend maths (dev editor)
  lib/layoutLint.ts          # pure layout checks: overlaps, out-of-bounds, label collisions (dev editor)
  lib/layoutChanges.ts       # human-readable change list (dev editor)
  lib/layoutDraft.ts         # localStorage drafts of unsaved edits (dev editor)
  lib/layoutSave.ts          # client of the dev-server save endpoint (dev editor)
vite-plugins/
  layoutPatch.ts             # rewrites x/y/width/bend literals in an index.ts (pure text in, text out)
  layoutWriter.ts            # dev-server-only POST /__dev/layout: patch + prettier + atomic write
```

Unit tests sit next to the code they cover (`*.test.ts`), including the layout editor's `src/lib/layout*.test.ts` and `vite-plugins/layout*.test.ts`.

## Adding a pattern

1. Copy `src/patterns/_template/` to `src/patterns/<category>/<slug>/` and set `slug` to the folder name. Pick a `category` (`creational`, `structural`, `behavioral` or `enterprise`) that matches the folder it lives in; new categories go in `Category` (`src/types/pattern.ts`) and `src/patterns/categories.ts`.
2. Fill in the text fields, the `participants` (boxes) and `relations` (arrows). Coordinates are box centres in an 800 × 460 viewBox; you can tune `x`, `y`, `width` and a relation's `bend` by dragging in the [layout editor](#editing-diagram-layouts-dev-only) instead of typing numbers.
3. Write the animated scenario in `steps`. Each step can
   - `highlight` participant/relation ids,
   - send `packets` along relations (`reverse: true` for return values), chained with `after` (see [Animating steps](#animating-steps)),
   - show small `notes` badges under participants,
   - highlight a `code` region.
4. Put the TypeScript example in `example.ts` (imported with `?raw` as `code`; excluded from `tsc` and lint). Mark regions with `// [id]` and `// [/id]` on their own lines. They are stripped before display. A participant highlights the region with the same id unless you set `code`.
5. Add `example.cs` (imported with `?raw` as `csharp`) with an equivalent C# example, shown as a second tab next to TypeScript. Use the exact same region ids as the TypeScript file — `npm test` checks that the set of region ids matches between the two, so steps/participants/relations highlight correctly whichever language is active.
6. Add `example.py` (imported with `?raw` as `python`) with an equivalent Python example, shown as another tab. Use the same region ids, written as Python comments: `# [id]` and `# [/id]`. Usage code goes at the bottom, as in TypeScript, and the file should run as-is with `python3 example.py`.
7. Add `example.go` (imported with `?raw` as `go`) with the equivalent Go example, shown as another tab. Use the same region ids, `package main`, and a `func main()` usage block at the bottom. `npm test` requires every pattern to ship this file.
8. Run `npm test` — it reports unknown ids, missing code regions and broken `related` links.

That's it: the sidebar, home grid and route (`#/patterns/<slug>`) pick it up automatically. No other file needs to change.

### Custom visualisations

The generic diagram covers most patterns. For a bespoke scene, add `Visualization.tsx` next to `index.ts` and set `Visualization` in the definition. It receives `VisualizationProps` (`pattern`, `color`, `step`, `stepIndex`, `speed`, `selectedId`, `onSelect`) — `color` is the category (or paradigm) accent colour, passed down by `PatternExplorer`. Call `onSelect(participantId)` when something is clicked so the detail panel and code highlighting keep working. You can reuse `<Diagram>` with `underlay`/`overlay` for extra animated elements — see `strategy`, `state`, `composite`, `circuit-breaker` or `architectures/layered` for examples (`singleton`, `builder`, `decorator`, `flyweight`, `iterator`, `chain-of-responsibility`, `memento`, `visitor`, `interpreter`, `dependency-injection`, `unit-of-work`, `pub-sub`, `null-object`, `object-pool` and `middleware` have custom scenes too).

Colour in a scene comes from the theme tokens, never from a hex literal or a Tailwind palette class (see [Theming](#theming); `npm test` fails on a raw colour). In a `className` use the token utilities (`fill-diagram-node`, `stroke-diagram-edge`, `text-fg-muted`); for values computed in code write `"var(--color-ok)"`, and use `alpha(color, 13)` for a tint of the accent rather than appending hex digits.

Every scene must animate packets through the shared timing, never its own `delay`s: pass `packetSpeed={speed}` to `<Diagram>`, or, in a fully custom SVG, render `<PacketLayer>` from `src/components/viz/PacketLayer.tsx` with `packets`, relation-keyed `geometry` (a Map or record), `color`, `speed` and `animationKey={stepIndex}`. Then `after`, the speed control and reduced motion all work, and the step player's timing matches what is on screen.

### Animating steps

A step's packets tell one story, and the viewer has to be able to follow it hop by hop. Packets are timed by `src/lib/packetTiming.ts`:

- **Independent packets** (no `after` anywhere in the step) start together with a small stagger and loop. Use this only for a true broadcast — one sender notifying several receivers, e.g. Observer's `notify()` or a pub/sub fan-out.
- **A chain** uses `after: <index>`: the packet waits until the earlier packet (zero-based index in the same step, always earlier in the array) has finished travelling. Every hop takes the same time (1.4 s at 1×), so a long chain is never squeezed.
- **Branches**: several packets with the same `after` start together once that packet lands, e.g. a publish followed by a fan-out.

```ts
packets: [
  { relation: "input", label: "click" }, // 0
  { relation: "delegate", label: "handleClick()", after: 0 },
  { relation: "execute", label: "execute()", after: 1 },
  { relation: "notifyList", label: "update()", after: 2 }, // branch:
  { relation: "notifyCount", label: "update()", after: 2 }, // both start together
  { relation: "execute", label: "ok", reverse: true, after: 2 },
];
```

Rules of thumb:

- Order packets the way the code runs them, and chain anything that is caused by an earlier packet: call → return, request → next hop in a pipeline, result bubbling back up. `npm test` rejects a packet that departs from where an earlier packet in the same step arrives unless it has `after`.
- If the step text says "first … then …", chain those packets even if they share a sender.
- Don't use `after` for more than one story per step — split a long scenario into several steps instead.

The step player waits for the animation: each step stays on screen for at least 3.2 s, or longer if its packets need it — every packet runs at least once and then settles for 0.8 s before the next step starts (`stepDuration`). Both scale with the speed control. A chained step loops after a short pause; independent packets loop continuously.

## Editing diagram layouts (dev only)

Layouts are hand-typed numbers, so there is a drag-and-drop editor for them. It exists only under `npm run dev`: the route, the header link ("Layout editor") and the save endpoint are all guarded by `import.meta.env.DEV` or `apply: "serve"`, so `npm run build` contains none of the editor's pages, drag handles, save code or endpoint. (`<Diagram>` loads its handle layer lazily, only in dev. The only traces left in a build are a `useContext` lookup in `<Diagram>` that always finds no editor, and a few `editor-*` colour tokens in the stylesheet.)

Open `http://localhost:5173/#/dev/layout` for the list of every pattern and architecture, or go straight to `/#/dev/layout/patterns/<slug>` or `/#/dev/layout/architecture/<slug>`. The page shows the real scene (the generic diagram or the pattern's own `Visualization.tsx`) with a step selector, so you can check each step's boxes, arrows and packets while you edit.

### Editing

- **Move a box**: drag it. Positions snap to a grid of 10 units; hold **Alt** to bypass snapping (free placement still lands on whole units). The snap step can be changed in the toolbar (off, 5, 10 or 20). A box can be dragged mostly off the canvas but never lost: at least 24 units of it (or half its size, if smaller) stay inside the viewBox, and the live lint reports `box-outside` for any box that is partly outside.
- **Bend an arrow**: drag the round handle at the midpoint of an arrow; this edits the relation's `bend`. Double-click it, or press **Enter** (or Space) while it is focused, to straighten it (`bend: 0`).
- **Resize a box**: select the box, then drag the handle on its right edge; this edits `width`.
- **Keyboard**: Tab to a box, bend or width handle and use the arrow keys to nudge by 1 unit (**Shift** = 10); on a width handle Right/Up widen and Left/Down narrow by that amount. Each key press is one undo step. **Escape** deselects.
- **Undo / redo**: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, or the toolbar buttons. One drag is one undo step. **Reset all** drops every change.
- **Show packets** hides the animated packets while you work on the boxes and arrows.
- **Changes** lists every changed participant and relation (old to new value) with a per-row **Revert**.
- **Drafts**: unsaved edits are kept in `localStorage` per pattern, so a reload does not lose them. Nothing is written to source until you save.

### Saving

- **Save to source** (dev server only) POSTs the changes to `POST /__dev/layout` (`vite-plugins/layoutWriter.ts`). The server rewrites only the numeric `x`, `y`, `width` and `bend` literals inside the `participants` and `relations` arrays of that folder's `index.ts` (`vite-plugins/layoutPatch.ts`), formats the file with prettier and writes it atomically; Vite then hot-updates the page. Comments, strings, ids, steps and everything else stay byte-for-byte as they were. A missing `x`/`y`/`width`/`bend` is inserted, `bend: 0` removes the property, and anything the patcher cannot place is an error rather than a guess. The endpoint rejects cross-site requests and is not part of `vite build` or `vite preview`.
- **Copy JSON** copies the changes as JSON (`{ participants: { id: { x, y, width } }, relations: { id: { bend } } }`). It always works and is the fallback when saving is not available (for example against a preview build); if the clipboard is blocked the JSON is shown in a text box to copy by hand.

After saving, review `git diff` (only layout lines should change) and run `npm test`: the registry validation still applies to the new numbers.

### Layout lint

A live check runs on every edit (`src/lib/layoutLint.ts`, listed under the diagram; click a finding to select what it names). Affected boxes, labels and arrows are outlined in the diagram. Rules:

- `box-overlap` (error): two boxes overlap.
- `box-outside` (error): a box is partly outside the viewBox.
- `box-gap` (warning): boxes are less than 20 units apart.
- `note-outside` (warning): the widest step note under a box would leave the viewBox.
- `label-overlap` / `label-box` (warning): an arrow label sits on another label or on a box.
- `edge-crossing` (warning): two arrows cross away from a box they share.
- `edge-through-box` (warning): an arrow runs through a box that is not one of its endpoints.

### Custom scenes: what follows the editor

The editor edits `participants` and `relations`, and every scene reads those. A custom `Visualization.tsx` follows only as far as its drawing is derived from them. An audit of all 31 custom scenes (bead `blcoyote-ideal-train-2yu.9`) found:

- **10 follow fully**: chain-of-responsibility, memento, state, strategy, circuit-breaker, null-object, object-pool, unit-of-work, flyweight and event-sourcing. Generic scenes (for example observer) follow too.
- **17 follow partially**: boxes, arrows and packets move, but background bands, regions and overlays that are constants in the scene (the CQRS write/read bands, the DDD bounded contexts, the hexagon, the layered bands, the MVU cycle, the iterator song strip, ...) stay where they were, so a moved box can end up outside its band. Middleware's reorder step also writes to the wrong participant. They are iterator, builder, singleton, dependency-injection, middleware, pub-sub, cqrs, ddd, event-driven, microservices, functional-core, mvu, pipes-and-filters, hexagonal, layered, mvc and vertical-slice.
- **4 render their own `<svg>` without `<Diagram>`** (interpreter, visitor, composite, decorator), so they get no handles; the editor page says so in a notice. Decorator additionally ignores its participants' coordinates entirely.

Follow-up work is tracked in beads: `blcoyote-ideal-train-2yu.12` (bands), `.13` (regions), `.14` (radial backdrops), `.15` (paths, rows and lanes), `.16` (anchored overlays), `.17` (middleware reorder step), `.18` (shared edit layer for own-svg scenes) and `.19` (decorator); the unrelated badge-at-origin rendering bug is `blcoyote-ideal-train-w9j`. New scenes should derive backdrops from participant positions (via `boxOf`) rather than constants, so the editor keeps working for them.

## Architecture

A second area, **Architecture** (`/architecture`), explains _architectural_ patterns — whole-system shapes like Layered or
CQRS — the same way the patterns above explain class-level ones: an animated, clickable diagram, a step player, linked
TypeScript/C#/Python code, and the usual problem/solution/pros/cons sections, plus a glossary of key concepts and (for a
few) named variants.

The twelve architectures, grouped by paradigm badge (`oo` | `functional` | `both`):

| Object-oriented                                                                       | Functional                                                                                                  | OO + Functional                                         |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Layered (N-tier), Hexagonal (Ports & Adapters), Model-View-Controller, Vertical Slice | Event Sourcing, Functional Core / Imperative Shell, Pipes and Filters, Model-View-Update (Elm Architecture) | Domain-Driven Design, CQRS, Microservices, Event-Driven |

### Cross-reference model

Architectures and design patterns link to each other through a **"Commonly used with"** box (`CrossReferenceBox`):

- **Architecture → design pattern** is declared by the architecture, in `commonlyUsedWith.designPatterns`, each with a
  `why` sentence. Every slug used in a `participant.patterns` array must also appear here (checked by `validateArchitecture`).
- **Design pattern → architecture** is never declared — it is _derived_: `lib/crossRefs.ts` scans every architecture's
  `commonlyUsedWith.designPatterns` for a given pattern slug and reuses that `why` text. This is why `patterns/registry.ts`
  never has to import anything from `architectures/`.
- **Architecture ↔ architecture** links must be declared on _both_ sides, each with its own `why` — `architectures/registry.test.ts`
  has a symmetry test that fails the build if `A` lists `B` but `B` doesn't list `A` back.

`src/lib/crossRefs.ts` is the only module that imports both `patterns/registry` and `architectures/registry`; this keeps
the dependency one-directional everywhere else and avoids a circular import between the two registries.

### Adding an architecture

1. Copy `src/architectures/_template/` to `src/architectures/<paradigm>/<slug>/` and set `slug` to the folder name. Pick a
   `paradigm` (`oo`, `functional` or `both`) that matches the folder it lives in — the colours live in `src/architectures/paradigms.ts`.
2. Fill in the text fields, `concepts` (a short glossary), optional `variants`, and the diagram (`participants`/`relations`),
   exactly like a pattern. Use `participant.patterns` to mark which design-pattern slugs a box is built with.
3. Fill in `commonlyUsedWith.designPatterns` (with a `why` for each) and `commonlyUsedWith.architectures` (declared
   symmetrically with any sibling architecture you reference).
4. Write the animated `steps`, and the TypeScript/C#/Python/Go examples in `example.ts`/`.cs`/`.py`/`.go` exactly as for a pattern —
   all four are required so the persisted language tab works on every architecture page.
5. Run `npm test` — besides the usual diagram/region checks, it also verifies the cross-reference symmetry rule above.

That's it: the sidebar (grouped by paradigm under `/architecture*`), the architecture index and the route
(`#/architecture/<slug>`) pick it up automatically.

## Which should I choose? (comparisons)

A third area, **Which should I choose?** (`/compare`), pits two or three look-alike patterns or architectures against
each other — same class shape, different intent — with a problem, a dimensions table, one card per option with inline
code and "see it animated" links into that subject's own diagram, a "no pattern at all" note, an optional overlap note,
and a scenario quiz the reader can try themselves. The page ends with an **export-as-ADR** section (`src/lib/adr.ts` +
`AdrExport.tsx`) that turns the chosen option into a downloadable, MADR-style decision record with YAML frontmatter,
ready to drop into a new project's `docs/decisions/`.

A comparison is pure data: it has no `example.ts`/`.cs`/`.py`/`.go` and no diagram of its own. `code` and `steps` on each
option are references (`{ kind, slug, region }` / `{ kind, slug, step }`) into regions and step indices that already
exist on the subjects, so there is never a fourth copy of an example to keep in sync across four languages. A pattern
or architecture page shows a derived **"Often confused with…"** box (`comparisonsFor(slug)`) when a comparison names it
— the pattern/architecture data itself never declares the link.

`src/comparisons/validate.ts` takes a subject resolver as a parameter instead of importing either registry, the same
way `DetailPanel` takes a `resolvePattern` prop — `src/lib/crossRefs.ts` stays the only module that imports both
`patterns/registry` and `architectures/registry`, via its `resolveSubject(ref)` helper.

### Adding a comparison

1. Copy `src/comparisons/_template/` to `src/comparisons/<slug>/` and set `slug` to the folder name.
2. Re-read the `index.ts` and all four example files of every subject you reference — every claim in `dimensions`,
   `options[].changes` and `options[].chooseWhen` must be literally true of all four languages, not just the one you
   remember. Use neutral wording where languages differ (see the "Honest about the pattern" rule in CLAUDE.md).
3. Point `options[].code` at existing region ids and `options[].steps` at existing 0-based step indices — `npm test`
   checks that every region and step reference resolves and is in range.
4. Give the `scenario` exactly one choice with `verdict: 'best'`, unique choice `id`s, and a non-empty `explanation` for
   every choice — `npm test` checks all three.
5. Run `npm test` — it reports an unresolved subject, an unknown region, an out-of-range step, or a malformed scenario.

That's it: the sidebar (under `/compare*`), the comparison index, the route (`#/compare/<slug>`) and any "Often
confused with…" box on the subjects' own pages pick it up automatically.

## Theming

Every colour decision lives in [`src/theme/tokens.css`](src/theme/tokens.css) and nowhere else (the one exemption is standalone image assets such as `public/favicon.svg`, which are separate documents that cannot read CSS variables; the guardrail test lists them), so changing how the site looks (or adding a theme) never means touching components. The file has three tiers:

1. **Primitives.** Tailwind's palette (`--color-slate-950`, …) plus a few literal hex values. The diagram, accent and status colours are literals on purpose: the SVG scenes have always used these sRGB hexes, and Tailwind v4's palette is wider-gamut oklch that renders visibly more vivid.
2. **Semantic roles.** What a colour is _for_: surfaces (`canvas`, `surface`, `surface-raised`), lines (`line`, `line-strong`), text (`fg`, `fg-body`, `fg-muted`, `fg-subtle`, `fg-on-accent`), status (`ok`, `warn`, `danger`), `diagram-*` for the SVG scenes, `code-*` / `syntax-*` for code blocks.
3. **Accents.** One pair per category and paradigm (`cat-creational` + `cat-creational-fg`, `paradigm-oo` + …). `categories.ts` and `paradigms.ts` carry the matching Tailwind class strings, which name these tokens.

Each `--color-<name>` becomes Tailwind utilities (`bg-surface`, `text-fg-muted`, `fill-diagram-node`, `ring-line`, with `/NN` opacity). In code, read a token as `"var(--color-<name>)"` and make a transparent tint with `alpha(color, percent)` from `src/theme/alpha.ts`; it is `color-mix()` underneath, so it works for hex and `var()` alike. `@theme static` keeps every token in the build even when only JS reads it.

Colour is not the only thing a theme can change. Four more token families sit in the same `@theme static` block and must be defined by every alternate theme (the guardrail test checks both directions, no missing and no extra):

- **Shape:** `--radius-control` (buttons, inputs, chips), `--radius-card`, `--radius-panel` (large frames), used as `rounded-control` / `rounded-card` / `rounded-panel`.
- **Elevation:** `--shadow-card` (resting) and `--shadow-raised` (hover, popovers), used as `shadow-card` / `shadow-raised`. Dark sets `none`.
- **Diagram effects:** `--diagram-glow`, a filter reference (`url(#glow)`, or `none`) read in code as `var(--diagram-glow)`; it is not a Tailwind namespace. The `--diagram-dim-*` opacities set how far dimmed nodes, edges and notes fade.
- **Code-block effects:** `--code-dim`, the opacity of code lines outside the highlighted region.

Card surfaces have their own colour roles, `--color-card` and `--color-card-outline`, so a theme can restyle cards without touching the page surfaces.

**Adding a token:** declare it in the `@theme static` block of `tokens.css` and give it a role comment. If a scene needs a colour no token covers, add a token for the role rather than a literal in the component.

**Adding a theme** is a block in `tokens.css` plus one entry in `themes.ts`:

```css
[data-theme="dark"] {
  color-scheme: dark;
  --color-canvas: var(--color-slate-950);
  /* … every --color-*, --radius-*, --shadow-*, --diagram-* and --code-* token the default theme declares … */
}
```

```ts
export const themes = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const satisfies readonly ThemeDefinition[];
```

The first entry is the default and is defined by `:root`, so it has no block. `useTheme()` returns `[theme, setTheme]`, persisted in localStorage (and synced across tabs for as long as a component is subscribed); an inline script injected into `index.html` (generated from `themes.ts` by `vite-plugins/themeBootstrap.ts`) applies the stored theme before first paint so nothing flashes. Light is the default theme and dark is the alternate; the switcher lives in the header (and in the mobile drawer). Fonts are bundled via `@fontsource` (Roboto Flex for text in both themes, JetBrains Mono for code), so nothing loads from a CDN.

`npm test` enforces the rules (`vite-plugins/themeGuardrails.test.ts`): no hex, `rgb()`, `color()`, `color-mix()` or Tailwind palette class outside `src/theme/` (scanning `src/`, `index.html` and `public/`), every `var(--color-…)` names a declared token, and every alternate theme defines a `color-scheme` and **every** colour token the default does (a missing one would silently inherit the light value).

## Used in this site

Many of the patterns above aren't just taught by this site — the site's own code uses them. A pattern or architecture
page shows a **"Used in this site"** box when its own code is tagged.

To tag a usage, add a comment directly above the code it describes, on its own line:

```ts
// @pattern observer: every CodeBlock subscribes to the shared language preference
```

- The grammar is `// @pattern <slug>: <explanation>`. `<slug>` is a design-pattern or architecture slug.
- The snippet shown in the box is the tag's following lines, up to the first blank line, capped at about 15 lines.
- Only `src/{components,hooks,lib}/**` and the two `registry.ts` files are scanned — **never** tag inside
  `src/patterns/**` or `src/architectures/**`, or every teaching example would tag itself.

A small Vite plugin (`vite-plugins/patternUsages.ts`) scans those files at build time and on dev-server start,
providing the result as the virtual module `virtual:pattern-usages` — only the extracted `{ slug, file, line,
explanation, snippet }` data, never full file contents. `src/lib/selfUsage.ts` reads that module and exposes
`usagesOf(slug)` and `usedSlugs()`, which `PatternPage`, `ArchitecturePage`, the home grid, the architecture index and
the sidebar all use. GitHub links point at `main`, since that's what's deployed.
