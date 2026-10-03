import type { PatternDefinition } from '@/types/pattern'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import pyExample from './example.py?raw'

export const pattern: PatternDefinition = {
  slug: 'cache-aside',
  name: 'Cache-Aside',
  category: 'enterprise',
  order: 9,
  summary: 'The application checks the cache first, loads from the source on a miss, and invalidates on writes.',
  intent:
    'Let the application code — not the store — manage the cache. On a read, check the cache first. On a miss, load from the slow source of truth and populate the cache. On a write, update the source and invalidate the cache entry, instead of trying to keep it in sync in place.',
  problem:
    'A slow or expensive source — a database under load, a remote service with a rate limit — gets hit on every read, even though most reads ask for the same handful of hot items over and over. Nothing stands between the callers and the source, so load scales with request volume instead of with how often the underlying data actually changes.',
  solution:
    'Put a Cache in front of the source and route every read through the application: look the key up in the cache; on a hit, return it with the source untouched; on a miss, load from the source, store the result in the cache, and return it. On a write, update the source first, then invalidate — not update — the cached entry, so the next read is a clean miss that reloads the fresh value rather than risking a half-updated cache entry. A caching Proxy achieves something similar but transparently: callers call what looks like the real service, and the proxy decides behind their back whether to hit the cache or the source. Cache-Aside is more work for the caller — it has to know the cache exists — but it keeps the cache policy visible and in the application\'s own control, rather than hidden behind an interception point. Read-through and write-through are the self-managing alternative: the cache itself knows how to load from (and, for write-through, write to) the source, so callers just talk to the cache. A no-TTL, never-invalidated special case of Cache-Aside is plain in-process memoization: fine as long as the underlying data cannot change for the lifetime of the cached key, which is exactly the trade this site makes in parseCode (see Real-world examples).',
  analogy:
    'Checking your own notes before calling a reference desk. You look at what you wrote down last time; if it is there, you use it and the desk never hears from you. If it is missing, you call the desk, get the answer, and jot it down for next time. Nobody at the desk decides when you take notes — that is entirely up to you.',
  whenToUse: [
    'Reads vastly outnumber writes, and the same keys are requested repeatedly.',
    'The source is slow, rate-limited, or expensive to query, and a little staleness is acceptable.',
    'You want the cache to be optional — the application still works, just slower, if the cache is empty or unavailable.',
    'You need the cache and the invalidation policy to live in application code that you can read, test and change, rather than inside a transparent interception layer.',
  ],
  pros: [
    'Only requested keys ever get cached — there is no need to warm or pre-populate anything.',
    'A cold or failed cache degrades to "every read hits the source," not a hard failure.',
    'The read/write policy — what to cache, for how long, when to invalidate — is ordinary application code, easy to read and to change.',
  ],
  cons: [
    'Every call site that reads through the cache has to know it exists and follow the same check-then-load protocol; a caching Proxy avoids this by making the cache transparent to callers.',
    'Concurrent readers and writers can race. A reader that misses can load the old value from the source, a writer can then update the source and invalidate, and the reader then caches the old value, which is served until its TTL expires or the next write. A reader that hits between the write and the invalidate only sees the old value briefly.',
    'TTLs and invalidation are extra configuration to choose and tune — too short defeats the cache, too long serves stale data for longer than intended.',
  ],
  realWorld: [
    'Redis or Memcached sitting in front of a SQL database, the textbook case the pattern is named for',
    'The "Cache-Aside" entry in Azure\'s cloud design patterns catalogue',
    'HTTP caching at a CDN edge, with explicit invalidation/purge on origin writes',
    'React Query and similar client-side data-fetching caches, which check a cache before calling the network and invalidate on mutations',
    'This site: parseCode in src/lib/codeRegions.ts checks an in-memory Map before re-parsing a source string, and populates it on a miss. It is the in-process memoization variant, not the TTL-bounded version demoed here: entries have no expiry and are never invalidated, which is safe because its input — a pattern\'s source text — never changes once loaded',
  ],
  related: ['proxy', 'flyweight', 'repository', 'circuit-breaker'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 90,
      y: 230,
      description: 'Calls ProductService.getProduct(id) and updateProduct(id, price). It never talks to Cache or ProductDatabase directly, and never checks which one answered.',
    },
    {
      id: 'service',
      label: 'ProductService',
      role: 'Cache-Aside policy',
      kind: 'class',
      x: 350,
      y: 230,
      width: 190,
      description: 'Owns the cache-aside logic. On a read: check Cache, fall back to ProductDatabase on a miss, then populate Cache. On a write: update ProductDatabase, then invalidate the entry in Cache.',
    },
    {
      id: 'cache',
      label: 'Cache',
      role: 'TTL-bounded store',
      kind: 'class',
      x: 620,
      y: 110,
      width: 160,
      description: 'An in-memory Map keyed by product id, holding a value plus an expiresAt timestamp. get() treats an entry as expired as soon as the clock reaches expiresAt (not just after it), reporting a miss and dropping it; set() and invalidate() are the only other operations.',
    },
    {
      id: 'database',
      label: 'ProductDatabase',
      role: 'Source of truth',
      kind: 'class',
      x: 620,
      y: 350,
      width: 170,
      description: 'The slow store underneath. Counts every call it answers, which is what lets the demo output show exactly when the cache saved a trip and when it did not.',
    },
    {
      id: 'clock',
      label: 'Clock',
      role: 'Injected fake clock',
      kind: 'object',
      x: 350,
      y: 400,
      width: 150,
      description: 'An integer nowMs that only moves when the usage code calls advance() — never real time. Cache reads it to stamp and check expiry; the usage code advances it directly to simulate the TTL elapsing.',
    },
  ],
  relations: [
    {
      id: 'request',
      from: 'client',
      to: 'service',
      type: 'calls',
      label: 'getProduct(id) / updateProduct(id, price)',
      description: 'The client always calls ProductService, never Cache or ProductDatabase directly — it has no idea which one actually answers.',
      code: 'service',
    },
    {
      id: 'cacheOp',
      from: 'service',
      to: 'cache',
      type: 'calls',
      label: 'get / set / invalidate',
      description: 'ProductService checks the cache on every read before considering the database, and invalidates the entry on every write.',
      code: 'cache',
    },
    {
      id: 'dbOp',
      from: 'service',
      to: 'database',
      type: 'calls',
      label: 'findById / update',
      description: 'ProductService only reaches the database on a cache miss, or to perform a write — never on a cache hit.',
      bend: 20,
      code: 'database',
    },
    {
      id: 'tick',
      from: 'cache',
      to: 'clock',
      type: 'calls',
      label: 'nowMs',
      description: 'Cache reads the clock\'s current value to stamp a new entry\'s expiresAt in set(), and to decide, in get(), whether an entry has already expired.',
      bend: -30,
      code: 'cache',
    },
    {
      id: 'advance',
      from: 'client',
      to: 'clock',
      type: 'calls',
      label: 'advance(ms)',
      description: 'The usage code advances the clock directly, bypassing ProductService entirely — this is what simulates "time passing" without any real timestamps.',
      bend: 50,
      code: 'client',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'First read misses the cache',
      description: 'The client asks ProductService for product p1. The cache has nothing stored yet, so it is a miss: ProductService falls through to ProductDatabase, loads the product, and populates the cache before returning it.',
      highlight: ['client', 'request', 'service', 'cacheOp', 'cache', 'dbOp', 'database'],
      packets: [
        { relation: 'request', label: 'getProduct("p1")' },
        { relation: 'cacheOp', label: 'get("p1") → miss' },
        { relation: 'dbOp', label: 'findById("p1")' },
        { relation: 'dbOp', label: 'Widget $9.99', reverse: true },
        { relation: 'cacheOp', label: 'set("p1", …)' },
      ],
      notes: { cache: 'miss', database: 'db calls: 1' },
      code: 'getProduct',
    },
    {
      title: 'Second read hits the cache',
      description: 'The same request comes in again. Cache already holds an unexpired entry for p1, so ProductService returns it directly — ProductDatabase is never touched, and its call count does not move.',
      highlight: ['client', 'request', 'service', 'cacheOp', 'cache'],
      packets: [
        { relation: 'request', label: 'getProduct("p1")' },
        { relation: 'cacheOp', label: 'get("p1") → hit' },
        { relation: 'request', label: 'Widget $9.99', reverse: true },
      ],
      notes: { cache: 'hit', database: 'db calls: 1 (hit)' },
      code: 'getProduct',
    },
    {
      title: 'A write invalidates the entry',
      description: 'The client asks ProductService to change p1\'s price. ProductService writes straight to ProductDatabase, then invalidates — rather than updates — the cache entry, so the database stays the single source of truth.',
      highlight: ['client', 'request', 'service', 'dbOp', 'database', 'cacheOp', 'cache'],
      packets: [
        { relation: 'request', label: 'updateProduct("p1", 14.99)' },
        { relation: 'dbOp', label: 'update("p1", 14.99)' },
        { relation: 'cacheOp', label: 'invalidate("p1")' },
      ],
      notes: { database: 'db calls: 2 (after invalidate)', cache: 'empty' },
      code: 'updateProduct',
    },
    {
      title: 'The next read is a clean miss',
      description: 'invalidate() removed the stale entry, so the following read finds nothing cached. ProductService reloads the updated price from ProductDatabase and caches it again.',
      highlight: ['client', 'request', 'service', 'cacheOp', 'cache', 'dbOp', 'database'],
      packets: [
        { relation: 'request', label: 'getProduct("p1")' },
        { relation: 'cacheOp', label: 'get("p1") → miss' },
        { relation: 'dbOp', label: 'findById("p1")' },
        { relation: 'dbOp', label: 'Widget $14.99', reverse: true },
        { relation: 'cacheOp', label: 'set("p1", …)' },
      ],
      notes: { cache: 'miss', database: 'db calls: 3' },
      code: 'getProduct',
    },
    {
      title: 'The clock advances past the TTL',
      description: 'The usage code calls clock.advance(), well past the cache\'s TTL — entirely fake, integer time, never a real clock. Cache still physically holds the entry, but its expiresAt has now passed.',
      highlight: ['client', 'advance', 'clock', 'cache'],
      packets: [{ relation: 'advance', label: 'advance(5001ms)' }],
      notes: { clock: 'nowMs: 5001', cache: 'entry now stale' },
      code: 'clock',
    },
    {
      title: 'Expiry forces one more miss',
      description: 'The next get() finds the entry\'s expiresAt in the past, drops it, and reports a miss, so ProductService reloads from ProductDatabase one more time. This is also the pattern\'s sharpest edge, which a single-threaded demo cannot show: a reader that misses can load the old value from the source before a write, and cache it after that write\'s invalidate(), so the old value persists until its TTL expires. A reader that hits between the write and the invalidate sees the old value only briefly.',
      highlight: ['client', 'request', 'service', 'cacheOp', 'cache', 'dbOp', 'database'],
      packets: [
        { relation: 'request', label: 'getProduct("p1")' },
        { relation: 'cacheOp', label: 'get("p1") → expired' },
        { relation: 'dbOp', label: 'findById("p1")' },
        { relation: 'dbOp', label: 'Widget $14.99', reverse: true },
        { relation: 'cacheOp', label: 'set("p1", …)' },
      ],
      notes: { cache: 'miss (expired)', database: 'db calls: 4' },
      code: 'getProduct',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,

  // Generic diagram is used — no custom Visualization.
}
