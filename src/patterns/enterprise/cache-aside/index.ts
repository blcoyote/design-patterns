import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "cache-aside",
  name: "Cache-Aside",
  category: "enterprise",
  order: 9,
  summary:
    "The application checks the cache first, loads from the source on a miss, and invalidates on writes.",
  intent:
    "Let the application manage its own cache: look there first, fall back to the real data source on a miss, and invalidate the entry when the data changes.",
  problem:
    "Some data is slow or costly to fetch: a database under heavy load, or a remote service that limits how often you can call it. Yet most reads ask for the same few popular items again and again. If nothing stands between callers and the source, every read hits the source, so its load grows with the number of requests instead of with how often the data actually changes.",
  solution:
    "Put a Cache in front of the source and make the application do the lookups itself. On a read, check the cache first. On a hit, return the cached value and leave the source alone. On a miss, load the value from the source, store it in the cache, and return it. On a write, update the source first, then invalidate (remove) the cached entry rather than updating it, so the next read is a clean miss that reloads the fresh value. A caching Proxy does something similar, but invisibly: callers think they are talking to the real service, and the proxy decides behind their backs whether to use the cache or the source. Cache-Aside asks more of the caller, which has to know the cache exists, but it keeps the caching policy visible and under the application's control. Read-through and write-through caches are the self-managing alternative: the cache itself knows how to load from (and, for write-through, write to) the source, so callers only talk to the cache. Plain in-process memoization is a special case of Cache-Aside with no TTL (time-to-live) and no invalidation. It is fine when the underlying data can never change while the key is cached, which is exactly the trade this site makes in parseCode (see Real-world examples).",
  analogy:
    "Think of checking your own notes before calling a reference desk. You look at what you wrote down last time. If the answer is there, you use it and the desk never hears from you. If it is not, you call the desk, get the answer, and jot it down for next time. Nobody at the desk decides when you take notes; that is entirely up to you.",
  whenToUse: [
    "Reads far outnumber writes, and the same keys are requested again and again.",
    "The source is slow, rate-limited or expensive to query, and a little staleness is acceptable.",
    "You want the cache to be optional: if it is empty, the application still works, just more slowly. (If the cache can be unavailable, the code that talks to it must catch those errors and fall back to the source.)",
    "You want the caching and invalidation rules in application code that you can read, test and change, not hidden inside a transparent interception layer.",
  ],
  pros: [
    "Only keys that are actually requested get cached, so there is nothing to warm up or pre-fill.",
    "A cold cache just means every read goes to the source. It is slower, not broken. (A cache that is down needs explicit fallback handling in your code.)",
    "What to cache, for how long and when to invalidate is ordinary application code, easy to read and change.",
  ],
  cons: [
    "Every place that reads through the cache has to know it exists and follow the same check-then-load steps. A caching Proxy avoids this by hiding the cache from callers.",
    "Readers and writers can race. A reader that misses may load the old value from the source. A writer can then update the source and invalidate. The reader then caches the old value, and it stays until its TTL expires or the next write. A reader that hits between a write and its invalidate sees the old value only briefly.",
    "TTLs and invalidation rules are extra settings to choose and tune. Too short and the cache barely helps; too long and you serve stale data longer than you meant to.",
  ],
  realWorld: [
    "Redis or Memcached in front of a SQL database, the classic case the pattern is named for",
    'The "Cache-Aside" entry in Azure\'s cloud design patterns catalogue',
    "Application code that wraps a Redis or Memcached lookup around a database query and deletes the key when the row changes",
    "React Query and similar client-side data-fetching caches, which check a cache before calling the network and invalidate on mutations",
    "This site: parseCode in src/lib/codeRegions.ts checks an in-memory Map before re-parsing a source string, and fills it on a miss. It is the in-process memoization variant, not the TTL-bounded version demoed here: entries never expire and are never invalidated, which is safe because a pattern's source text never changes once loaded",
  ],
  related: ["proxy", "flyweight", "repository", "circuit-breaker"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 90,
      y: 230,
      description:
        "Calls ProductService.getProduct(id) and updateProduct(id, price). It never talks to Cache or ProductDatabase directly, and never checks which one answered.",
    },
    {
      id: "service",
      label: "ProductService",
      role: "Cache-Aside policy",
      kind: "class",
      x: 350,
      y: 230,
      width: 190,
      description:
        "Owns the cache-aside logic. On a read: check Cache, fall back to ProductDatabase on a miss, then populate Cache. On a write: update ProductDatabase, then invalidate the entry in Cache.",
    },
    {
      id: "cache",
      label: "Cache",
      role: "TTL-bounded store",
      kind: "class",
      x: 620,
      y: 110,
      width: 160,
      description:
        "An in-memory Map keyed by product id, holding a value plus an expiresAt timestamp. get() treats an entry as expired as soon as the clock reaches expiresAt (not just after it), reporting a miss and dropping it; set() and invalidate() are the only other operations.",
    },
    {
      id: "database",
      label: "ProductDatabase",
      role: "Source of truth",
      kind: "class",
      x: 620,
      y: 350,
      width: 170,
      description:
        "The slow store underneath. Counts every call it answers, which is what lets the demo output show exactly when the cache saved a trip and when it did not.",
    },
    {
      id: "clock",
      label: "Clock",
      role: "Injected fake clock",
      kind: "object",
      x: 350,
      y: 400,
      width: 150,
      description:
        "An integer nowMs that only moves when the usage code calls advance() — never real time. Cache reads it to stamp and check expiry; the usage code advances it directly to simulate the TTL elapsing.",
    },
  ],
  relations: [
    {
      id: "request",
      from: "client",
      to: "service",
      type: "calls",
      label: "getProduct(id) / updateProduct(id, price)",
      description:
        "The client always calls ProductService, never Cache or ProductDatabase directly — it has no idea which one actually answers.",
      code: "service",
    },
    {
      id: "cacheOp",
      from: "service",
      to: "cache",
      type: "calls",
      label: "get / set / invalidate",
      description:
        "ProductService checks the cache on every read before considering the database, and invalidates the entry on every write.",
      code: "cache",
    },
    {
      id: "dbOp",
      from: "service",
      to: "database",
      type: "calls",
      label: "findById / update",
      description:
        "ProductService only reaches the database on a cache miss, or to perform a write — never on a cache hit.",
      bend: 20,
      code: "database",
    },
    {
      id: "tick",
      from: "cache",
      to: "clock",
      type: "calls",
      label: "nowMs",
      description:
        "Cache reads the clock's current value to stamp a new entry's expiresAt in set(), and to decide, in get(), whether an entry has already expired.",
      bend: -30,
      code: "cache",
    },
    {
      id: "advance",
      from: "client",
      to: "clock",
      type: "calls",
      label: "advance(ms)",
      description:
        'The usage code advances the clock directly, bypassing ProductService entirely — this is what simulates "time passing" without any real timestamps.',
      bend: 50,
      code: "client",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "First read misses the cache",
      description:
        "The client asks ProductService for product p1. The cache has nothing stored yet, so it is a miss: ProductService falls through to ProductDatabase, loads the product, and populates the cache before returning it.",
      highlight: [
        "client",
        "request",
        "service",
        "cacheOp",
        "cache",
        "dbOp",
        "database",
      ],
      packets: [
        { relation: "request", label: 'getProduct("p1")' },
        { relation: "cacheOp", label: 'get("p1") → miss', after: 0 },
        { relation: "dbOp", label: 'findById("p1")', after: 1 },
        { relation: "dbOp", label: "Widget $9.99", reverse: true, after: 2 },
        { relation: "cacheOp", label: 'set("p1", …)', after: 3 },
      ],
      notes: { cache: "miss", database: "db calls: 1" },
      code: "getProduct",
    },
    {
      title: "Second read hits the cache",
      description:
        "The same request comes in again. Cache already holds an unexpired entry for p1, so ProductService returns it directly — ProductDatabase is never touched, and its call count does not move.",
      highlight: ["client", "request", "service", "cacheOp", "cache"],
      packets: [
        { relation: "request", label: 'getProduct("p1")' },
        { relation: "cacheOp", label: 'get("p1") → hit', after: 0 },
        { relation: "request", label: "Widget $9.99", reverse: true, after: 1 },
      ],
      notes: { cache: "hit", database: "db calls: 1 (hit)" },
      code: "getProduct",
    },
    {
      title: "A write invalidates the entry",
      description:
        "The client asks ProductService to change p1's price. ProductService writes straight to ProductDatabase, then invalidates — rather than updates — the cache entry, so the database stays the single source of truth.",
      highlight: [
        "client",
        "request",
        "service",
        "dbOp",
        "database",
        "cacheOp",
        "cache",
      ],
      packets: [
        { relation: "request", label: 'updateProduct("p1", 14.99)' },
        { relation: "dbOp", label: 'update("p1", 14.99)', after: 0 },
        { relation: "cacheOp", label: 'invalidate("p1")', after: 1 },
      ],
      notes: { database: "db calls: 2 (after invalidate)", cache: "empty" },
      code: "updateProduct",
    },
    {
      title: "The next read is a clean miss",
      description:
        "invalidate() removed the stale entry, so the following read finds nothing cached. ProductService reloads the updated price from ProductDatabase and caches it again.",
      highlight: [
        "client",
        "request",
        "service",
        "cacheOp",
        "cache",
        "dbOp",
        "database",
      ],
      packets: [
        { relation: "request", label: 'getProduct("p1")' },
        { relation: "cacheOp", label: 'get("p1") → miss', after: 0 },
        { relation: "dbOp", label: 'findById("p1")', after: 1 },
        { relation: "dbOp", label: "Widget $14.99", reverse: true, after: 2 },
        { relation: "cacheOp", label: 'set("p1", …)', after: 3 },
      ],
      notes: { cache: "miss", database: "db calls: 3" },
      code: "getProduct",
    },
    {
      title: "The clock advances past the TTL",
      description:
        "The usage code calls clock.advance(), well past the cache's TTL — entirely fake, integer time, never a real clock. Cache still physically holds the entry, but its expiresAt has now passed.",
      highlight: ["client", "advance", "clock", "cache"],
      packets: [{ relation: "advance", label: "advance(5001ms)" }],
      notes: { clock: "nowMs: 5001", cache: "entry now stale" },
      code: "clock",
    },
    {
      title: "Expiry forces one more miss",
      description:
        "The next get() finds the entry's expiresAt in the past, drops it, and reports a miss, so ProductService reloads from ProductDatabase one more time. This is also the pattern's sharpest edge, which a single-threaded demo cannot show: a reader that misses can load the old value from the source before a write, and cache it after that write's invalidate(), so the old value persists until its TTL expires. A reader that hits between the write and the invalidate sees the old value only briefly.",
      highlight: [
        "client",
        "request",
        "service",
        "cacheOp",
        "cache",
        "dbOp",
        "database",
      ],
      packets: [
        { relation: "request", label: 'getProduct("p1")' },
        { relation: "cacheOp", label: 'get("p1") → expired', after: 0 },
        { relation: "dbOp", label: 'findById("p1")', after: 1 },
        { relation: "dbOp", label: "Widget $14.99", reverse: true, after: 2 },
        { relation: "cacheOp", label: 'set("p1", …)', after: 3 },
      ],
      notes: { cache: "miss (expired)", database: "db calls: 4" },
      code: "getProduct",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  // Generic diagram is used — no custom Visualization.
};
