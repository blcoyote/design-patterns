# design-patterns

An interactive, animated guide to all 23 Gang of Four design patterns plus 7 common enterprise patterns, and a second
area covering 6 software **architectures**, built with **React + TypeScript + Tailwind CSS v4** (Vite).

Every pattern and architecture has:

- an **animated diagram** — press play and watch messages travel between objects (or layers, or services), step by step
- **clickable parts** — click any class or arrow to see its role, its connections, and the exact lines of code that implement it
- TypeScript, C# and Python examples, problem/solution/analogy, when to use it, pros & cons, real-world uses and related patterns

| Creational | Structural | Behavioral | Enterprise |
| --- | --- | --- | --- |
| Singleton, Factory Method, Builder, Abstract Factory, Prototype | Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight | Observer, Strategy, Command, Iterator, State, Template Method, Chain of Responsibility, Mediator, Memento, Visitor, Interpreter | Dependency Injection, Repository, Unit of Work, Pub/Sub, Circuit Breaker, Null Object, Object Pool |

Separately, **Architecture** (`/architecture`) covers Layered, Hexagonal, Domain-Driven Design, CQRS, Event Sourcing and
Functional Core / Imperative Shell — see [Architecture](#architecture) below.

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
    <category>/<slug>/example.ts/.cs/.py # code samples, imported with ?raw
    <category>/<slug>/Visualization.tsx # optional custom animated scene
    _template/               # copy me to add a pattern (ignored by the registry)
  architectures/
    registry.ts              # auto-discovers every src/architectures/*/*/index.ts
    paradigms.ts             # paradigm labels + colours (oo / functional / both)
    validate.ts              # validateDiagram (shared) + validateArchitecture
    <paradigm>/<slug>/index.ts          # one folder per architecture, grouped by paradigm (pure data)
    <paradigm>/<slug>/example.ts/.cs/.py # code samples, same convention as patterns
    <paradigm>/<slug>/Visualization.tsx # optional custom animated scene
    _template/               # copy me to add an architecture (ignored by the registry)
  components/
    viz/                     # Diagram, DiagramNode, DiagramEdge, Packet, StepPlayer, DetailPanel, PatternExplorer
    content/CrossReferenceBox.tsx # "commonly used with" links between the two areas
    pages/ layout/ content/
  lib/codeRegions.ts         # `// [id]` … `// [/id]` code region markers
  lib/crossRefs.ts           # the only module importing both registries — see "Architecture" below
```

## Adding a pattern

1. Copy `src/patterns/_template/` to `src/patterns/<category>/<slug>/` and set `slug` to the folder name. Pick a `category` (`creational`, `structural`, `behavioral` or `enterprise`) that matches the folder it lives in; new categories go in `Category` (`src/types/pattern.ts`) and `src/patterns/categories.ts`.
2. Fill in the text fields, the `participants` (boxes) and `relations` (arrows). Coordinates are box centres in an 800 × 460 viewBox.
3. Write the animated scenario in `steps`. Each step can
   - `highlight` participant/relation ids,
   - send `packets` along relations (`reverse: true` for return values),
   - show small `notes` badges under participants,
   - highlight a `code` region.
4. Put the TypeScript example in `example.ts` (imported with `?raw` as `code`; excluded from `tsc` and lint). Mark regions with `// [id]` and `// [/id]` on their own lines. They are stripped before display. A participant highlights the region with the same id unless you set `code`.
5. Optionally add `example.cs` (imported with `?raw` as `csharp`) with an equivalent C# example, shown as a second tab next to TypeScript. Use the exact same region ids as the TypeScript file — `npm test` checks that the set of region ids matches between the two, so steps/participants/relations highlight correctly whichever language is active.
6. Optionally add `example.py` (imported with `?raw` as `python`) with an equivalent Python example, shown as another tab. Use the same region ids, written as Python comments: `# [id]` and `# [/id]`. Usage code goes at the bottom, as in TypeScript, and the file should run as-is with `python3 example.py`.
7. Run `npm test` — it reports unknown ids, missing code regions and broken `related` links.

That's it: the sidebar, home grid and route (`#/patterns/<slug>`) pick it up automatically. No other file needs to change.

### Custom visualisations

The generic diagram covers most patterns. For a bespoke scene, add `Visualization.tsx` next to `index.ts` and set `Visualization` in the definition. It receives `VisualizationProps` (`pattern`, `color`, `step`, `stepIndex`, `selectedId`, `onSelect`) — `color` is the category (or paradigm) accent colour, passed down by `PatternExplorer`. Call `onSelect(participantId)` when something is clicked so the detail panel and code highlighting keep working. You can reuse `<Diagram>` with `underlay`/`overlay` for extra animated elements — see `strategy`, `state`, `composite`, `circuit-breaker` or `architectures/layered` for examples (`singleton`, `builder`, `decorator`, `flyweight`, `iterator`, `chain-of-responsibility`, `memento`, `visitor`, `interpreter`, `dependency-injection`, `unit-of-work`, `pub-sub`, `null-object` and `object-pool` have custom scenes too).

## Architecture

A second area, **Architecture** (`/architecture`), explains *architectural* patterns — whole-system shapes like Layered or
CQRS — the same way the patterns above explain class-level ones: an animated, clickable diagram, a step player, linked
TypeScript/C#/Python code, and the usual problem/solution/pros/cons sections, plus a glossary of key concepts and (for a
few) named variants.

The six planned architectures, grouped by paradigm badge (`oo` | `functional` | `both`):

| Object-oriented | Functional | OO + Functional |
| --- | --- | --- |
| Layered (N-tier), Hexagonal (Ports & Adapters), Domain-Driven Design | Event Sourcing, Functional Core / Imperative Shell | CQRS |

### Cross-reference model

Architectures and design patterns link to each other through a **"Commonly used with"** box (`CrossReferenceBox`):

- **Architecture → design pattern** is declared by the architecture, in `commonlyUsedWith.designPatterns`, each with a
  `why` sentence. Every slug used in a `participant.patterns` array must also appear here (checked by `validateArchitecture`).
- **Design pattern → architecture** is never declared — it is *derived*: `lib/crossRefs.ts` scans every architecture's
  `commonlyUsedWith.designPatterns` for a given pattern slug and reuses that `why` text. This is why `patterns/registry.ts`
  never has to import anything from `architectures/`.
- **Architecture ↔ architecture** links must be declared on *both* sides, each with its own `why` — `architectures/registry.test.ts`
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
4. Write the animated `steps`, and the TypeScript/C#/Python examples in `example.ts`/`.cs`/`.py` exactly as for a pattern —
   all three are required so the persisted language tab works on every architecture page.
5. Run `npm test` — besides the usual diagram/region checks, it also verifies the cross-reference symmetry rule above.

That's it: the sidebar (grouped by paradigm under `/architecture*`), the architecture index and the route
(`#/architecture/<slug>`) pick it up automatically.
