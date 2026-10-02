# design-patterns

An interactive, animated guide to all 23 Gang of Four design patterns plus 7 common architectural patterns, built with **React + TypeScript + Tailwind CSS v4** (Vite).

Every pattern has:

- an **animated diagram** — press play and watch messages travel between objects, step by step
- **clickable parts** — click any class or arrow to see its role, its connections, and the exact lines of code that implement it
- a TypeScript example, problem/solution/analogy, when to use it, pros & cons, real-world uses and related patterns

| Creational | Structural | Behavioral | Architectural |
| --- | --- | --- | --- |
| Singleton, Factory Method, Builder, Abstract Factory, Prototype | Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight | Observer, Strategy, Command, Iterator, State, Template Method, Chain of Responsibility, Mediator, Memento, Visitor, Interpreter | Dependency Injection, Repository, Unit of Work, Pub/Sub, Circuit Breaker, Null Object, Object Pool |

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
  types/pattern.ts           # PatternDefinition – the shape of a pattern
  patterns/
    registry.ts              # auto-discovers every src/patterns/*/index.ts
    categories.ts            # category labels + colours
    validate.ts              # consistency checks (used in dev + tests)
    <slug>/index.ts          # one folder per pattern (pure data)
    <slug>/Visualization.tsx # optional custom animated scene
    _template/               # copy me to add a pattern (ignored by the registry)
  components/
    viz/                     # Diagram, DiagramNode, DiagramEdge, Packet, StepPlayer, DetailPanel, PatternExplorer
    pages/ layout/ content/
  lib/codeRegions.ts         # `// [id]` … `// [/id]` code region markers
```

## Adding a pattern

1. Copy `src/patterns/_template/` to `src/patterns/<slug>/` and set `slug` to the folder name. Pick a `category` (`creational`, `structural`, `behavioral` or `architectural`); new categories go in `Category` (`src/types/pattern.ts`) and `src/patterns/categories.ts`.
2. Fill in the text fields, the `participants` (boxes) and `relations` (arrows). Coordinates are box centres in an 800 × 460 viewBox.
3. Write the animated scenario in `steps`. Each step can
   - `highlight` participant/relation ids,
   - send `packets` along relations (`reverse: true` for return values),
   - show small `notes` badges under participants,
   - highlight a `code` region.
4. Mark regions in `code` with `// [id]` and `// [/id]` on their own lines. They are stripped before display. A participant highlights the region with the same id unless you set `code`.
5. Optionally add a `csharp` field with an equivalent C# example, shown as a second tab next to TypeScript. Use the exact same region ids as `code` — `npm test` checks that the set of region ids matches between the two, so steps/participants/relations highlight correctly whichever language is active.
6. Run `npm test` — it reports unknown ids, missing code regions and broken `related` links.

That's it: the sidebar, home grid and route (`#/patterns/<slug>`) pick it up automatically. No other file needs to change.

### Custom visualisations

The generic diagram covers most patterns. For a bespoke scene, add `Visualization.tsx` next to `index.ts` and set `Visualization` in the definition. It receives `VisualizationProps` (`pattern`, `step`, `stepIndex`, `selectedId`, `onSelect`). Call `onSelect(participantId)` when something is clicked so the detail panel and code highlighting keep working. You can reuse `<Diagram>` with `underlay`/`overlay` for extra animated elements — see `strategy`, `state`, `composite` or `circuit-breaker` for examples (`singleton`, `builder`, `decorator`, `flyweight`, `iterator`, `chain-of-responsibility`, `memento`, `visitor`, `interpreter`, `dependency-injection`, `unit-of-work`, `pub-sub`, `null-object` and `object-pool` have custom scenes too).
