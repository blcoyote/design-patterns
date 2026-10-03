# Tasks: patterns this site uses on itself

The site's own source code uses many of the patterns it teaches. This document describes three tasks:

1. **Add the Plugin pattern.** The site depends on it heavily, but the catalogue doesn't have it yet.
2. **Add the Cache-Aside pattern.** The site uses it in `parseCode`, and the catalogue doesn't have it yet.
3. **Show "Used in this site" on pattern pages.** A pattern page links to the places where this site's own code uses that pattern.

Every task follows the paved path in [CLAUDE.md](../../CLAUDE.md): patterns are data, there are three languages with one set of regions, the parity traps apply, and you verify before calling a task done.

## Inventory: where the site already uses patterns

This is the starting data for task 3. Each row becomes one `@pattern` tag (see task 3).

| Pattern | Where | What it does there |
| --- | --- | --- |
| `observer` | `src/hooks/useCodeLanguage.ts` (`listeners`, `emit`, `subscribe`) | Every code block subscribes to the language preference, so picking C# once switches all of them. |
| `pub-sub` | `src/hooks/useCodeLanguage.ts` (`storage` event listener) | The browser's `storage` event carries a language change to other tabs, and the tabs don't know about each other. |
| `singleton` | `src/lib/prismGlobal.ts`, `src/hooks/useCodeLanguage.ts` (`cached`) | There is exactly one shared Prism instance, so the C# grammar registers on the instance that renders. There is also one language preference per app. |
| `strategy` | `src/components/viz/PatternExplorer.tsx` (`pattern.Visualization ?? GenericVisualization`) | Every scene implements `VisualizationProps`, and the explorer never knows which scene it is rendering. |
| `iterator` | `src/hooks/useStepPlayer.ts` | A cursor over the steps (`next`, `prev`, `goTo`) keeps the steps themselves plain data. |
| `repository` | `src/patterns/registry.ts`, `src/architectures/registry.ts` | `getPattern`, `byCategory` and `byParadigm` give the UI a collection-like interface over the definitions. |
| `facade` | `src/lib/crossRefs.ts` | The only module that imports both registries. Pages ask it one question instead of combining two registries themselves. |
| `adapter` | `src/lib/crossRefs.ts` (`resolvePattern`, `resolveArchitecture`) | Two different definition shapes become one `ResolvedLink`. |
| `dependency-injection` | `src/components/viz/DetailPanel.tsx` (`resolvePattern` prop) | The resolver is passed in, so the patterns side never imports the architectures side. |
| `template-method` | `src/components/viz/Diagram.tsx` (`underlay` / `overlay`) | A fixed rendering skeleton with hooks that each scene fills in. It uses composition instead of inheritance. Say so in the description. |
| `plugin` (task 1) | `src/patterns/registry.ts`, `src/architectures/registry.ts` (`import.meta.glob`) | Adding a folder adds a page with no registration code. The virtual module from task 3 is a second example. |
| `cache-aside` (task 2) | `src/lib/codeRegions.ts` (`cache` in `parseCode`) | Look the parsed result up in the cache. On a miss, parse it and store it. |
| `functional-core` (architecture) | `src/patterns/validate.ts`, `src/architectures/validate.ts` plus the definitions as pure data | Pure validators and immutable definitions sit at the core, and React is the imperative shell. |
| `cqrs` (architecture) | `src/lib/crossRefs.ts` (`architecturesUsing`) | The reverse links are a read model projected from the single write side (`commonlyUsedWith`). |

Deliberately left out: Null Object, because `GenericVisualization` is a default strategy, not a do-nothing object. State is also left out, because the step player is a single `playing` boolean, not a state machine.

---

## Task 1: Plugin pattern (`enterprise/plugin`)

**Folder:** `src/patterns/enterprise/plugin/`, copied from `src/patterns/_template/`. The folder holds `index.ts`, `example.ts`, `example.cs`, `example.py`, and optionally `Visualization.tsx`.

**Definition fields**

- `category: 'enterprise'`, `order: 8`
- `name: 'Plugin'`
- **Intent** (Fowler, *Patterns of Enterprise Application Architecture*): link implementations at configuration or start-up time, not compile time. The host only knows an interface and a registry. Plugins are discovered and registered without the host changing.
- `related: ['strategy', 'abstract-factory', 'factory-method', 'dependency-injection']`

**Scenario:** a document exporter host. The host knows the `Exporter` interface (`id`, `export(doc)`) and asks a `PluginRegistry` for an exporter by id. A `PluginLoader` reads a manifest (a plain list of plugin ids and modules) and registers each plugin. The concrete plugins are `MarkdownExporter` and `HtmlExporter`.

**Discovery must work the same way in all three languages.** Use an explicit manifest plus a factory map, not reflection or dynamic imports. Mention each language's real-world mechanism in a comment only, per CLAUDE.md ("Honest about the pattern"):
- Vite: `import.meta.glob`
- C#: assembly scanning or MEF
- Python: `importlib.metadata` entry points

**Participants:** Host, `Exporter` (interface), `PluginRegistry`, `PluginLoader`, Manifest, `MarkdownExporter`, `HtmlExporter`.

**Steps (6–8):**
1. The host starts with an empty registry.
2. The loader reads the manifest.
3. Each plugin registers itself under its id.
4. The host asks for `html`.
5. The registry returns the plugin, and the host calls `export()`.
6. A new plugin is added to the manifest with no change to the host.
7. An unknown id fails with a clear error that lists the registered ids.

**Seen in the wild:** VS Code extensions, Vite and webpack plugins, Python `entry_points`, Eclipse OSGi bundles, and **this site**. Its registry auto-discovers every pattern folder with `import.meta.glob`, and `CLAUDE.md` says "Never hand-register a pattern".

**Cross-references (optional, recommended):** add `plugin` to `hexagonal`'s `commonlyUsedWith.designPatterns`, with the reason "adapters are plugged into ports at composition time". Attach it to a participant via `patterns` (validation requires the box entry). The reverse box on the Plugin page then appears automatically.

## Task 2: Cache-Aside pattern (`enterprise/cache-aside`)

**Folder:** `src/patterns/enterprise/cache-aside/`, same file set as task 1.

**Definition fields**

- `category: 'enterprise'`, `order: 9`
- `name: 'Cache-Aside'`
- **Intent:** the application code (not the store) manages the cache. On a read, check the cache. On a miss, load from the slow source and populate the cache. On a write, update the source and invalidate the cache entry.
- `related: ['proxy', 'flyweight', 'repository', 'circuit-breaker']`. A caching proxy is the transparent alternative; contrast the two in the solution text.

**Scenario:** `ProductService.getProduct(id)` in front of a slow `ProductDatabase` that counts its calls, with an in-memory `Cache` that has a TTL.

**Parity rules for this scenario:**
- Time comes from an injected fake clock with an integer `now` that the usage code advances. Do not use real timestamps (CLAUDE.md: "IDs: use counters, not timestamps"; the same reasoning applies to time).
- The output prints the database call count after each operation, so the step notes are reproducible. For example: `db calls: 1`, `db calls: 1 (hit)`, `db calls: 2 (after invalidate)`.
- Keep the cache in a `Map`, a `Dictionary` and a `dict`, never a Python `set`.

**Participants:** Client, `ProductService`, `Cache`, `ProductDatabase`, Clock.

**Steps (6–8):**
1. First read: a miss, so load from the database and put the result in the cache.
2. Second read: a hit, so there is no database call.
3. Update: write to the database and invalidate the cache entry.
4. Read after the update: a miss, so the value is reloaded.
5. The clock advances past the TTL, so the entry expires and the next read is a miss.
6. Optional: the stale-read risk between write and invalidate, as a con.

**Variants to name in the text:**
- Read-through and write-through, where the store or cache manages itself.
- In-process memoization, the no-TTL, never-invalidated special case. This is what the site's `parseCode` does: its input is immutable source text, so entries never go stale.

**Seen in the wild:** Redis or Memcached in front of SQL, the cache-aside guidance in Azure's cloud design patterns, HTTP CDNs, React Query, and **this site**: `parseCode` in `src/lib/codeRegions.ts`.

## Task 3: "Used in this site" on pattern and architecture pages

### Goal

When a pattern is used by this site's own code, its page shows a **"Used in this site"** box. The box lists each usage with:
- the file and line, linked to GitHub;
- a one-line explanation;
- a short syntax-highlighted snippet.

Cards on the home grid and in the sidebar get a small badge, so the site's own patterns are easy to find. Architecture pages get the same box.

### Design: tags in the code, collected at build time

Hand-maintained lists of file paths go stale. Instead, the usage sites tag themselves, and a build step collects the tags. This step is itself the Plugin pattern, which makes a nice loop with task 1.

**1. The tag format.** Put the tag in a comment on its own line, directly above the code it describes:

```ts
// @pattern observer: every CodeBlock subscribes to the shared language preference
```

- The grammar is `// @pattern <slug>: <explanation>`.
- One tag covers the next declaration or statement. The snippet is the tag's following lines, up to the first blank line, capped at about 15 lines.
- Architectures use the same tag with the architecture slug: `// @pattern functional-core: …`. Slugs are unique across both registries (pattern slugs and architecture slugs don't collide today). The test below keeps it that way.
- Only scan `src/{components,hooks,lib}/**` and the two `registry.ts` files. **Never scan inside pattern or architecture folders**, or every teaching example would tag itself.

**2. A virtual module from a small Vite plugin.**
- `vite-plugins/patternUsages.ts` registers the virtual module `virtual:pattern-usages`.
- At build time (and on dev server start, with HMR on changes to scanned files) it scans the files above and emits only the extracted data: `{ slug, file, line, explanation, snippet }[]`.
- This keeps the full source text out of the bundle. `import.meta.glob(..., { query: '?raw' })` would ship every scanned file.
- Add a type declaration in `src/types/virtual-modules.d.ts`.
- Vitest uses the same `vite.config.ts`, so tests can import the virtual module.

**3. Data access.**
- `src/lib/selfUsage.ts` exports `usagesOf(slug)` and `usedSlugs()`.
- It imports from the virtual module and builds GitHub links. Keep the repo URL and branch in one constant: `https://github.com/blcoyote/design-patterns/blob/main/<file>#L<line>`. The site deploys from `main`, so line numbers match the deployed code.

**4. UI.**
- A `UsedInThisSite` component in `src/components/content/`. Give it a visually distinct box style that matches `CrossReferenceBox`, with the heading "Used in this site". Each entry shows:
  - the file path and line as a link that opens GitHub in a new tab, with `rel="noreferrer"`;
  - the explanation;
  - the snippet, rendered with the existing `CodeBlock` (TypeScript only, no tabs, no highlight).
- `PatternPage` and `ArchitecturePage` render the box after the cross-reference box, only when usages exist.
- Add a small "used here" badge on the `HomePage` cards, the `ArchitectureIndexPage` cards and the `Sidebar` entries. Use an icon plus an `aria-label`, so it isn't conveyed by colour alone.
- Optional: an "Used in this site" filter chip on the home grid.

**5. Tagging.** Add one `@pattern` tag per row of the inventory table above. Adjust the explanation text to read well in the UI.

**6. Tests**, in `src/lib/selfUsage.test.ts`:
- every tagged slug exists in the pattern or architecture registry;
- no tag sits inside `src/patterns/**` or `src/architectures/**`;
- every entry has a non-empty explanation and snippet;
- pattern and architecture slugs don't collide;
- the scanner's parsing is unit-tested on a fixture string (tag grammar, snippet cut-off at a blank line, the line cap).

**7. Docs.**
- README gets a "Used in this site" section explaining the tag.
- `CLAUDE.md` §1 gets one line: tag usages with `// @pattern <slug>: …` instead of listing files anywhere.

---

## Execution plan

As in previous features, Opus plans and verifies, and Sonnet subagents build. Each agent gets this file plus CLAUDE.md as its brief and owns its files exclusively.

| Phase | Agent | Owns |
| --- | --- | --- |
| 1 (parallel) | A: Plugin pattern | `src/patterns/enterprise/plugin/` |
| 1 (parallel) | B: Cache-Aside pattern | `src/patterns/enterprise/cache-aside/` |
| 1 (parallel) | C: "Used in this site" | `vite-plugins/`, `vite.config.ts`, `src/lib/selfUsage*`, `src/types/virtual-modules.d.ts`, `src/components/**`, README, CLAUDE.md, `@pattern` tags in non-pattern source |
| 2 | Orchestrator | Optional `hexagonal` → `plugin` cross-ref; full verification; parity review (one review agent per new pattern, as done for the architectures) |

Agent C tags `plugin` and `cache-aside` in phase 1 even though the pages don't exist yet. Expect the "slug exists" test to fail until A and B land.

## Done when

- [ ] `npm test`, `npx tsc -b`, `npm run lint` and `npm run build` are green.
- [ ] Every `example.py` passes `python3 -W error`, and the new `example.ts` files type-check standalone (CLAUDE.md §4).
- [ ] For Plugin and Cache-Aside, the TS, Python and C# output is byte-identical, with C# run under a `da_DK` locale.
- [ ] The Plugin and Cache-Aside pages animate and step through, and each lists this site as a real-world use.
- [ ] Every pattern and architecture in the inventory shows the "Used in this site" box, and every GitHub link points at the tagged line on `main`.
- [ ] Badges appear on cards and in the sidebar for exactly the tagged slugs.
- [ ] No full source text is shipped. Check with `grep` on `dist/assets/*.js`: only the extracted snippets should be there.
