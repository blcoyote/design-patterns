import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "dataloader",
  name: "DataLoader (Batching)",
  category: "enterprise",
  order: 13,
  summary:
    "Collect the keys requested within one scheduling window (one tick), then fetch them all in a single batched query.",
  intent:
    "Avoid the N+1 query problem by letting each caller ask for one item by key while the loader quietly gathers those keys, removes duplicates, and fetches them together in one round trip. Results are cached per request, so asking for the same key again costs nothing.",
  problem:
    "A page lists three posts and each post shows its author. PostResolver handles one post at a time, so it naturally asks the database for one author per post: one query for the posts plus one per author, N+1 in total. Two of the posts have the same author, so even those queries repeat. With a hundred posts that is a hundred round trips, and no single resolver can fix it because none of them knows what the others are asking for.",
  solution:
    "Put a UserLoader between the resolvers and the database. A resolver calls load(id) and immediately gets back a Pending result. The loader queues the id, and a repeated id reuses the Pending it already handed out. At the end of the current tick, dispatch() sends every queued id to the database in one query, matches the returned rows back to their keys by id, and fills in each Pending. Because the cache lives as long as the loader, a later load of a known id is answered without any query. Create one loader per request.",
  analogy:
    "A waiter does not run to the kitchen for each guest's order. They take every order at the table, merge identical dishes, make one trip, and then bring each plate back to the right person.",
  whenToUse: [
    "A tree of independent resolvers or handlers each fetch related rows by key, as in a GraphQL server.",
    "The same key is likely to be requested several times while one request is being handled.",
    "The data source offers a batch lookup, such as WHERE id IN (…) or a bulk API call.",
  ],
  pros: [
    "Replaces N+1 round trips with one query per batch, without making resolvers aware of each other.",
    "Duplicate keys are fetched once, and later loads of a known key are free.",
    "Callers keep a simple one-key-at-a-time interface; the batching is hidden inside the loader.",
  ],
  cons: [
    "A key that is not cached yet is only available after the batch is dispatched, so callers have to wait for it. A cached key is answered at once.",
    "The loader needs a reliable moment to dispatch: real implementations use the end of the event-loop tick, and in other runtimes this takes a scheduler or explicit flush.",
    "The cache must not outlive the request, or it serves stale data and can leak one user's data to another, so a new loader is needed per request.",
    "The batch lookup must return a result for every key in a form that can be matched back, and one missing row has to be handled deliberately.",
  ],
  realWorld: [
    "Facebook's DataLoader library for JavaScript, used in most GraphQL servers",
    "GreenDonut in Hot Chocolate (.NET GraphQL)",
    "aiodataloader in Python and dataloaden / dataloadgen in Go",
    "Laravel's eager loading and Hibernate's batch fetching solve the same N+1 problem inside the ORM",
  ],
  related: ["cache-aside", "repository"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "postResolver",
      label: "PostResolver",
      role: "Caller",
      kind: "class",
      x: 110,
      y: 110,
      width: 170,
      description:
        "Resolves the author of one post at a time. With a loader it just calls load(authorId) and gets a Pending result straight back, knowing nothing about the other posts.",
    },
    {
      id: "userLoader",
      label: "UserLoader",
      role: "DataLoader",
      kind: "class",
      x: 420,
      y: 110,
      width: 180,
      description:
        "Queues the ids it is asked for, shares one Pending per id, and on dispatch() fetches all queued ids with one database query. It is created per request, so its cache is discarded with the request.",
    },
    {
      id: "database",
      label: "UserDatabase",
      role: "Data source",
      kind: "object",
      x: 420,
      y: 350,
      width: 180,
      description:
        "Answers findByIds with every matching row in one round trip. It may return the rows in any order, which is why the loader matches them to keys by id.",
    },
  ],
  relations: [
    {
      id: "naive",
      from: "postResolver",
      to: "database",
      type: "calls",
      label: "1 query per post",
      description:
        "What the resolver would do without a loader: ask the database for each post's author separately. Three posts means three queries.",
      code: "naiveAuthor",
    },
    {
      id: "load",
      from: "postResolver",
      to: "userLoader",
      type: "calls",
      label: "load(id)",
      description:
        "The resolver asks the loader for one user by id. The loader queues new ids and answers repeated ids from its cache.",
      code: "loaderLoad",
    },
    {
      id: "batch",
      from: "userLoader",
      to: "database",
      type: "calls",
      label: "IN (u1, u2)",
      description:
        "On dispatch, the loader sends every queued id in one query and then hands each row to the Pending that is waiting for it.",
      code: "loaderBatch",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Without a loader: one query per post",
      description:
        "Each post asks the database for its own author: u1, then u2, then u1 again. Three posts cost three queries, and the third one repeats the first.",
      highlight: ["postResolver", "naive", "database"],
      packets: [
        { relation: "naive", label: "find u1" },
        { relation: "naive", label: "Ada", reverse: true, after: 0 },
        { relation: "naive", label: "find u2", after: 1 },
        { relation: "naive", label: "Grace", reverse: true, after: 2 },
        { relation: "naive", label: "find u1", after: 3 },
        { relation: "naive", label: "Ada", reverse: true, after: 4 },
      ],
      notes: { database: "3 queries" },
      code: "naiveAuthor",
    },
    {
      title: "With a loader: resolvers only queue",
      description:
        "Now the resolvers call load() instead. P1 asks for u1 and P2 asks for u2. Each call returns a Pending result immediately and nothing has hit the database yet.",
      highlight: ["postResolver", "load", "userLoader"],
      packets: [
        { relation: "load", label: "load u1" },
        { relation: "load", label: "load u2", after: 0 },
      ],
      notes: { userLoader: "queue: u1, u2", database: "0 queries" },
      code: "loaderLoad",
    },
    {
      title: "A repeated key shares its slot",
      description:
        "P3 also wants u1. The loader already has a Pending for u1, so it returns that one and does not queue the id a second time.",
      highlight: ["postResolver", "load", "userLoader"],
      packets: [{ relation: "load", label: "load u1" }],
      notes: { userLoader: "queue: u1, u2" },
      code: "loaderLoad",
    },
    {
      title: "End of the tick: one batched query",
      description:
        "All three resolvers have asked, so the loader dispatches. It sends the queued ids u1 and u2 in a single query and gets two rows back.",
      highlight: ["userLoader", "batch", "database"],
      packets: [
        { relation: "batch", label: "IN (u1, u2)" },
        { relation: "batch", label: "2 rows", reverse: true, after: 0 },
      ],
      notes: { database: "1 query", userLoader: "queue: empty" },
      code: "loaderBatch",
    },
    {
      title: "Rows are matched back to keys",
      description:
        "The database returned Grace before Ada, the opposite of the order the keys were asked in. The loader matches rows to keys by id, so each Pending gets the right user, and both P1 and P3 get Ada.",
      highlight: ["userLoader", "load", "postResolver"],
      packets: [
        { relation: "load", label: "Ada", reverse: true },
        { relation: "load", label: "Grace", reverse: true },
      ],
      notes: { postResolver: "Ada, Grace, Ada" },
      code: "loaderBatch",
    },
    {
      title: "A repeat load hits the cache",
      description:
        "Asking for u1 again later in the same request is answered from the loader's cache. The database sees no second query.",
      highlight: ["postResolver", "load", "userLoader"],
      packets: [
        { relation: "load", label: "load u1" },
        { relation: "load", label: "Ada (cached)", reverse: true, after: 0 },
      ],
      notes: { database: "1 query" },
      code: "loaderLoad",
    },
    {
      title: "Three queries became one",
      description:
        "The naive resolver made 3 queries for 3 posts. The loader made 1 for this batch, however many posts it holds and however often an author repeats. Keys requested in a later tick form a new batch. Create a new loader for the next request so its cache starts empty.",
      highlight: ["postResolver", "userLoader", "database"],
      code: "userLoader",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
