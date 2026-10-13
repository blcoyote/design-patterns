import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "bulkhead",
  name: "Bulkhead",
  category: "enterprise",
  order: 20,
  summary:
    "Give each dependency its own small, fixed number of concurrent calls, so a slow or failing dependency fills only its own compartment and cannot starve the calls to everything else.",
  intent:
    "Split the resources that calls to different dependencies compete for into separate compartments with a fixed size each, so that a problem with one dependency can use up only its own compartment and the calls to the other dependencies keep working.",
  problem:
    "A service calls several dependencies and they all draw on one shared pool: the same threads, connections or concurrency limit. When one dependency becomes slow, its calls stay in flight for a long time and keep their slots. New calls to it arrive faster than old ones finish, so the slow dependency soon holds every slot. Calls to the healthy dependencies are then refused or left waiting, although nothing is wrong with those dependencies. One slow dependency has turned into an outage for everything that shares its pool.",
  solution:
    "Give each dependency its own Bulkhead: a fixed number of slots, an in-flight count and a rejected count. Before a call starts, the Dependency makes the try-acquire check. If the in-flight count is below the limit, the count goes up by one and the call goes ahead. If it is at the limit, the call is rejected at once and counted, and it never takes a slot. When a call finishes, the finish call gives the slot back. In this example the usage code finishes the calls itself, which stands in for a slow response: the first run shares one Bulkhead of 4 slots between payments and recommendations, so four slow recommendations calls leave no slot for payments. The second run gives each dependency its own Bulkhead of 2 slots. Recommendations fills its own two slots and is rejected, while payments still starts and finishes its call, and a slot that recommendations frees can be taken by the next call. The concurrency is simulated: a started call stays in flight until the calling code finishes it, and there are no threads, timers or waiting. Real calls finish on their own schedule on many threads, so a real limiter has to be thread-safe (atomic counters or a semaphore). The example has no waiting queue either, so a full Bulkhead rejects at once, where real ones often allow a short wait or a bounded queue before they reject. A Bulkhead only limits how many calls are in flight at the same time, and slots come back only when calls finish. That is why it is normally combined with timeouts, so that a call cannot hold a slot forever, and with a Circuit Breaker, which stops calling a dependency that keeps failing. This example has neither.",
  analogy:
    'The pattern is named after the watertight compartments in the hull of a ship. The hull is divided by walls, so a leak floods one compartment and not the whole ship. In software the compartments are separate pools of calls, and a flooded one is a dependency that has used up all of its slots. Michael Nygard\'s book "Release It!" made Bulkhead one of the standard stability patterns for software that has to stay up while its dependencies misbehave.',
  whenToUse: [
    "A service calls several dependencies (other services, databases, third-party APIs) and a slow one must not be able to take away the capacity needed for the others. Microservices are a typical place for this.",
    "The dependencies differ in how important they are. A critical one such as payments should not lose its capacity to a nice-to-have one such as recommendations.",
    "A failing or slow dependency would otherwise hold threads, connections or concurrent calls for long enough to exhaust a pool that is shared with other work.",
  ],
  pros: [
    "A problem with one dependency is contained: it can use up only its own compartment, so calls to the others keep going.",
    "Failing fast is cheap. A call that finds its compartment full is rejected at once instead of piling up behind the slow ones.",
    "The rejected count per compartment shows which dependency is overloaded.",
    "The compartments can be sized to the importance of each dependency: a critical dependency can be given a compartment that others cannot touch.",
  ],
  cons: [
    "Sizing is hard. A compartment that is too small rejects healthy traffic, and one that is too large protects nothing. The right numbers depend on load and latency, and they change over time.",
    "A bulkhead frees slots only when calls finish, so it does not stop a call from hanging. Use it with timeouts and a Circuit Breaker, which this example does not have.",
    "Separate compartments cannot lend each other their spare capacity. Total capacity that was shared before is now split, so some of it can sit idle while another compartment is full.",
    "There is no waiting queue in this example, so a call that arrives at a full compartment is rejected at once. Real bulkheads often allow a short wait or a bounded queue, which brings its own settings to tune.",
    "A rejected call is still a failed call. The caller needs a fallback, such as a default value, a retry later or an error for the user.",
    "In real code the counting has to be thread-safe, and with thread-pool isolation each compartment also costs threads and context switches.",
  ],
  realWorld: [
    "Resilience4j has a Bulkhead module for the JVM, in a semaphore-based variant and a thread-pool-based variant.",
    "Polly for .NET: v7 has a BulkheadPolicy; v8 has no bulkhead strategy and limits concurrency with AddConcurrencyLimiter from its rate-limiter package (Polly.RateLimiting).",
    "Netflix Hystrix isolated each dependency's calls in its own thread pool. It is now in maintenance mode, and Netflix points new work to Resilience4j.",
    "A dedicated thread pool or connection pool per dependency is the same idea built from plain parts, and so is a semaphore or concurrency limit per dependency.",
    'Michael Nygard\'s book "Release It!" describes Bulkheads together with timeouts and Circuit Breakers as stability patterns.',
  ],
  related: ["circuit-breaker", "object-pool"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Checkout",
      role: "Caller",
      kind: "client",
      x: 100,
      y: 230,
      code: "usage",
      description:
        "Stands for the calling code, the usage block at the bottom or top of the file, depending on the language. It runs the shared scenario first and the isolated scenario second, starts calls on the dependencies and decides when a started call finishes. Finishing a call is what stands in for the slow response arriving.",
    },
    {
      id: "payments",
      label: "payments",
      role: "Dependency (fast)",
      kind: "class",
      x: 330,
      y: 140,
      width: 150,
      code: "dependency",
      description:
        'A Dependency named "payments". The start call asks its Bulkhead to admit the call and records the call id as in flight if it is admitted. The finish call removes the id and gives the slot back. Each run creates its own payments object, so in the shared run it uses the shared pool and in the isolated run it uses its own Bulkhead. It is "fast" only in the sense that the isolated run finishes its call at once. Nothing else in the example makes it faster.',
    },
    {
      id: "recommendations",
      label: "recommendations",
      role: "Dependency (slow)",
      kind: "class",
      x: 330,
      y: 320,
      width: 160,
      code: "dependency",
      description:
        'A Dependency named "recommendations", the same class as payments. It is "slow" because the usage code leaves its calls in flight, which stands in for slow responses. In the shared run none of r1 to r4 is finished. Each run creates its own recommendations object, using the shared pool in the first run and its own Bulkhead in the second.',
    },
    {
      id: "sharedPool",
      label: "shared pool (4)",
      role: "No bulkhead: one shared limit",
      kind: "object",
      x: 640,
      y: 230,
      width: 170,
      code: "shared",
      description:
        'One Bulkhead named "shared" with room for 4 concurrent calls, used by payments and recommendations together. It is the baseline without isolation: one limit for everything, so whatever fills it affects both dependencies. In the shared run, recommendations takes all 4 slots and the call from payments is rejected.',
    },
    {
      id: "paymentsBulkhead",
      label: "payments bulkhead (2)",
      role: "Bulkhead",
      kind: "object",
      x: 640,
      y: 70,
      width: 200,
      code: "bulkhead",
      description:
        'A Bulkhead named "payments" with room for 2 concurrent calls, used only by payments in the isolated run. The try-acquire check compares the in-flight count with the limit before it adds the call: at the limit it counts a rejection and says no, otherwise it takes a slot. It has no waiting queue, so a full Bulkhead rejects at once. Nothing recommendations does can change its counts.',
    },
    {
      id: "recsBulkhead",
      label: "recommendations bulkhead (2)",
      role: "Bulkhead",
      kind: "object",
      x: 640,
      y: 390,
      width: 230,
      code: "bulkhead",
      description:
        'A Bulkhead named "recommendations" with room for 2 concurrent calls, used only by recommendations in the isolated run. When the slow calls fill it, it rejects further calls to recommendations, and that is where the damage stops: the payments Bulkhead is a separate object.',
    },
  ],
  relations: [
    {
      id: "start-payments",
      from: "client",
      to: "payments",
      type: "calls",
      label: "start / finish",
      description:
        "The calling code starts a call with a call id and, later, finishes it. The start call tells it whether the call was admitted or rejected.",
      code: "dependency",
    },
    {
      id: "start-recommendations",
      from: "client",
      to: "recommendations",
      type: "calls",
      label: "start / finish",
      description:
        "The same two calls for recommendations. Calls that the usage code never finishes stay in flight and keep their slots, which stands in for a slow dependency.",
      code: "dependency",
    },
    {
      id: "payments-shared",
      from: "payments",
      to: "sharedPool",
      type: "calls",
      label: "tryAcquire",
      description:
        "In the shared run, payments asks the shared pool for a slot. The answer is no if recommendations has already filled it.",
      code: "bulkhead",
    },
    {
      id: "recommendations-shared",
      from: "recommendations",
      to: "sharedPool",
      type: "calls",
      label: "tryAcquire",
      description:
        "In the shared run, recommendations asks the shared pool for a slot. Each admitted call takes one of the 4, and none of them finishes.",
      code: "bulkhead",
    },
    {
      id: "payments-own",
      from: "payments",
      to: "paymentsBulkhead",
      type: "calls",
      label: "tryAcquire",
      description:
        "In the isolated run, payments asks its own Bulkhead for a slot, and the finish call gives the slot back through the release call on the same Bulkhead.",
      code: "bulkhead",
    },
    {
      id: "recommendations-own",
      from: "recommendations",
      to: "recsBulkhead",
      type: "calls",
      label: "tryAcquire",
      description:
        "In the isolated run, recommendations asks its own Bulkhead for a slot, and the finish call gives the slot back through the release call on the same Bulkhead.",
      code: "bulkhead",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Two dependencies, one of them slow",
      description:
        "A service calls payments and recommendations, and recommendations is slow. The example runs two scenarios in this order. First both dependencies share one limit of 4 concurrent calls, then each has a Bulkhead of 2. A Bulkhead holds a limit, an in-flight count and a rejected count, and rejects at once when it is full.",
      highlight: [
        "client",
        "payments",
        "recommendations",
        "sharedPool",
        "paymentsBulkhead",
        "recsBulkhead",
      ],
      code: "bulkhead",
    },
    {
      title: "The shared pool fills up",
      description:
        "In the shared run, the calling code starts four recommendations calls, r1 to r4, and does not finish any of them. Each call is admitted by the try-acquire check and takes one of the 4 slots. After r4 the shared pool is full.",
      highlight: [
        "client",
        "start-recommendations",
        "recommendations",
        "recommendations-shared",
        "sharedPool",
      ],
      packets: [
        { relation: "start-recommendations", label: "start r1" },
        { relation: "recommendations-shared", label: "tryAcquire", after: 0 },
        { relation: "recommendations-shared", label: "ok", reverse: true, after: 1 },
        { relation: "start-recommendations", label: "start r2", after: 2 },
        { relation: "recommendations-shared", label: "tryAcquire", after: 3 },
        { relation: "recommendations-shared", label: "ok", reverse: true, after: 4 },
        { relation: "start-recommendations", label: "start r3", after: 5 },
        { relation: "recommendations-shared", label: "tryAcquire", after: 6 },
        { relation: "recommendations-shared", label: "ok", reverse: true, after: 7 },
        { relation: "start-recommendations", label: "start r4", after: 8 },
        { relation: "recommendations-shared", label: "tryAcquire", after: 9 },
        { relation: "recommendations-shared", label: "ok", reverse: true, after: 10 },
      ],
      notes: { sharedPool: "4/4 in flight", recommendations: "r1 r2 r3 r4" },
      code: "shared",
    },
    {
      title: "Payments is rejected",
      description:
        "Still in the shared run, the calling code starts the payments call p1. The shared pool is full, so the try-acquire check rejects it and counts one rejection. The call never takes a slot. Nothing is wrong with payments: a slow dependency used up the slots that payments needed, and the failure spread to a healthy one.",
      highlight: ["client", "start-payments", "payments", "payments-shared", "sharedPool"],
      packets: [
        { relation: "start-payments", label: "start p1" },
        { relation: "payments-shared", label: "tryAcquire", after: 0 },
        { relation: "payments-shared", label: "full", reverse: true, after: 1 },
      ],
      notes: { sharedPool: "4/4 · rejected 1", payments: "p1 rejected" },
      code: "shared",
    },
    {
      title: "Isolated: recommendations fills its own compartment",
      description:
        "In the isolated run, payments and recommendations each get a Bulkhead of 2 slots. The calling code starts the recommendations calls r1 and r2, and both are admitted. The recommendations Bulkhead is now full, at 2 of 2.",
      highlight: [
        "client",
        "start-recommendations",
        "recommendations",
        "recommendations-own",
        "recsBulkhead",
      ],
      packets: [
        { relation: "start-recommendations", label: "start r1" },
        { relation: "recommendations-own", label: "tryAcquire", after: 0 },
        { relation: "recommendations-own", label: "ok", reverse: true, after: 1 },
        { relation: "start-recommendations", label: "start r2", after: 2 },
        { relation: "recommendations-own", label: "tryAcquire", after: 3 },
        { relation: "recommendations-own", label: "ok", reverse: true, after: 4 },
      ],
      notes: { recsBulkhead: "2/2 in flight", recommendations: "r1 r2" },
      code: "isolated",
    },
    {
      title: "Only recommendations is rejected",
      description:
        "The calling code starts r3. Its own Bulkhead is full, so the try-acquire check rejects the call at once, with no waiting queue, and counts one rejection. The rejected call never takes a slot, so r1 and r2 stay in flight. The damage stops at the edge of the compartment.",
      highlight: [
        "client",
        "start-recommendations",
        "recommendations",
        "recommendations-own",
        "recsBulkhead",
      ],
      packets: [
        { relation: "start-recommendations", label: "start r3" },
        { relation: "recommendations-own", label: "tryAcquire", after: 0 },
        { relation: "recommendations-own", label: "full", reverse: true, after: 1 },
      ],
      notes: { recsBulkhead: "2/2 · rejected 1", recommendations: "r1 r2" },
      code: "bulkhead",
    },
    {
      title: "Payments still gets through",
      description:
        "The calling code starts the payments call p1. The payments Bulkhead is a separate object with its own count, so it admits the call at 1 of 2, even though recommendations is full. The same call id, p1, was rejected in the shared run.",
      highlight: ["client", "start-payments", "payments", "payments-own", "paymentsBulkhead"],
      packets: [
        { relation: "start-payments", label: "start p1" },
        { relation: "payments-own", label: "tryAcquire", after: 0 },
        { relation: "payments-own", label: "ok", reverse: true, after: 1 },
      ],
      notes: {
        paymentsBulkhead: "1/2 in flight",
        payments: "p1",
        recsBulkhead: "2/2 · rejected 1",
      },
      code: "isolated",
    },
    {
      title: "A finished call frees its slot",
      description:
        "The calling code finishes p1. The finish call finds the id in the list of in-flight calls, removes it and gives the slot back to the payments Bulkhead, which goes from 1 of 2 to 0 of 2. Slots come back only when calls finish.",
      highlight: ["client", "start-payments", "payments", "payments-own", "paymentsBulkhead"],
      packets: [
        { relation: "start-payments", label: "finish p1" },
        { relation: "payments-own", label: "release", after: 0 },
      ],
      notes: { paymentsBulkhead: "0/2 in flight", payments: "none in flight" },
      code: "dependency",
    },
    {
      title: "A freed slot is reused",
      description:
        "The calling code finishes r1, so the recommendations Bulkhead goes from 2 of 2 to 1 of 2. It then starts r4, which is admitted and takes the freed slot, so the Bulkhead is full again at 2 of 2. Calls r2 and r4 are still in flight.",
      highlight: [
        "client",
        "start-recommendations",
        "recommendations",
        "recommendations-own",
        "recsBulkhead",
      ],
      packets: [
        { relation: "start-recommendations", label: "finish r1" },
        { relation: "recommendations-own", label: "release", after: 0 },
        { relation: "start-recommendations", label: "start r4", after: 1 },
        { relation: "recommendations-own", label: "tryAcquire", after: 2 },
        { relation: "recommendations-own", label: "ok", reverse: true, after: 3 },
      ],
      notes: { recsBulkhead: "2/2 in flight", recommendations: "r2 r4" },
      code: "isolated",
    },
    {
      title: "Summary",
      description:
        "After both runs the usage code prints the rejected counts: shared 1, payments 0 and recommendations 1. With one shared limit a slow dependency made a healthy one fail. With a Bulkhead each, only the slow one was refused. A Bulkhead only limits concurrent calls and gets slots back when calls finish, so use it with timeouts and a Circuit Breaker. This example has neither.",
      highlight: ["client", "sharedPool", "paymentsBulkhead", "recsBulkhead"],
      notes: {
        sharedPool: "4/4 · rejected 1",
        paymentsBulkhead: "0/2 · rejected 0",
        recsBulkhead: "2/2 · rejected 1",
      },
      code: "usage",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
