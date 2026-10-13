/**
 * Bulkhead and Circuit Breaker are both stability patterns for calls to a dependency, and both
 * can end a call early with a rejection, which is why they get mixed up. They react to different
 * things: a Bulkhead counts calls in flight, a Circuit Breaker counts failures. Every claim below
 * was checked against `src/patterns/enterprise/bulkhead` and `src/patterns/enterprise/circuit-breaker`
 * (index.ts and all four language examples), not against the patterns in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "bulkhead-vs-circuit-breaker",
  title: "Bulkhead vs Circuit Breaker",
  order: 15,
  summary:
    "Both reject calls early to keep a service up. A Bulkhead caps how many calls to one dependency are in flight; a Circuit Breaker stops calling a dependency that keeps failing.",
  subjects: [
    { kind: "pattern", slug: "bulkhead" },
    { kind: "pattern", slug: "circuit-breaker" },
  ],
  problem:
    "A checkout service calls payments and a nice-to-have recommendations service. When recommendations misbehaves, its calls pile up and the service starts to suffer for it: calls to payments, which is healthy, get refused or wait. Something has to limit the damage that one troubled dependency can do to the caller.",
  constraints: [
    "Is the trouble that too many calls to one dependency are in flight at once, or that the dependency keeps failing?",
    "Must a critical dependency keep capacity that a less important one cannot take?",
    "Should the caller stop contacting the dependency for a while, or only limit how much of its own capacity the dependency can occupy?",
    "Do you want the system to notice recovery by itself, and how: a slot freed by a finished call, or a trial call after a cooldown?",
    "Do you already have timeouts? Neither pattern here ends a call that hangs.",
  ],
  dimensions: [
    {
      label: "What it protects",
      values: {
        bulkhead:
          "The caller’s capacity. Each dependency gets its own fixed number of slots, so a slow dependency can fill only its own compartment and calls to the other dependencies keep their slots.",
        "circuit-breaker":
          "The caller’s time and resources, and the failing dependency. Once the breaker is open, calls are rejected immediately and the dependency is not contacted at all until a cooldown has passed.",
      },
    },
    {
      label: "What triggers a rejection",
      values: {
        bulkhead:
          "Concurrency: the in-flight count has reached the limit. The dependency does not have to be failing, and the example counts only calls in flight, not whether they succeed.",
        "circuit-breaker":
          "Failures: the failure count has reached the threshold of 3, and a success resets the count to zero. In this example only calls that fail with an error are counted, and a call that is merely slow is not.",
      },
    },
    {
      label: "State it keeps",
      values: {
        bulkhead:
          "Per compartment: a limit, an in-flight count and a rejected count. In the example the shared pool has 4 slots and each isolated Bulkhead has 2.",
        "circuit-breaker":
          "A mode (Closed, Open or Half-Open), a failure count and the time of the next allowed attempt, measured against the example’s fake clock.",
      },
    },
    {
      label: "What callers see",
      values: {
        bulkhead:
          "When the compartment is full the start call reports the call as rejected at once, and the rejected call never takes a slot. Calls to other dependencies are unaffected.",
        "circuit-breaker":
          "While the breaker is Open the call fails fast with an error, “circuit open, failing fast”, and the wrapped function never runs. While the single Half-Open trial is in flight, other calls also fail fast.",
      },
    },
    {
      label: "How it recovers",
      values: {
        bulkhead:
          "When a started call finishes, its slot comes back and the next call can take it. Slots return only when calls finish, so a call that never finishes keeps its slot.",
        "circuit-breaker":
          "After the cooldown of 4000 ms the next call is let through as the one trial call. If it succeeds the breaker closes and the count resets; if it fails the breaker goes back to Open for another cooldown.",
      },
    },
    {
      label: "What it does not do",
      values: {
        bulkhead:
          "It does not stop calling a dependency that fails: while there is a free slot, every call is admitted. It also cannot end a call that hangs. This example has no timeouts and no Circuit Breaker.",
        "circuit-breaker":
          "It does not limit how many calls are in flight: while Closed, any number of calls pass through, so it does not give payments a protected share of the caller’s capacity. This example has no timeouts and no Bulkhead.",
      },
    },
  ],
  options: [
    {
      subject: "bulkhead",
      changes:
        "Each Dependency gets a Bulkhead with its own slots. In the isolated run payments and recommendations have 2 slots each. The try-acquire check admits a call while the in-flight count is below the limit and rejects it at once otherwise, so recommendations call r3 is rejected while payments call p1 still starts. Nothing looks at whether calls succeed; a slot comes back only when a started call finishes.",
      chooseWhen: [
        "A dependency that is slow, not necessarily failing, can hold on to calls long enough to use up capacity that other dependencies need.",
        "The dependencies differ in importance, and a critical one should have capacity that a nice-to-have one cannot touch.",
        "A rejection that depends on load is acceptable, and callers have a fallback for it, such as a default value, a retry later or an error for the user.",
      ],
      code: [
        { kind: "pattern", slug: "bulkhead", region: "bulkhead" },
        { kind: "pattern", slug: "bulkhead", region: "isolated" },
      ],
      steps: [
        { kind: "pattern", slug: "bulkhead", step: 2 },
        { kind: "pattern", slug: "bulkhead", step: 4 },
        { kind: "pattern", slug: "bulkhead", step: 5 },
      ],
    },
    {
      subject: "circuit-breaker",
      changes:
        "CircuitBreaker wraps the call to RemoteService with a failure threshold of 3 and a cooldown of 4000 ms. While Closed it passes calls through and counts failures. At the third failure it opens and rejects calls without running them. Once the cooldown has passed, the next call is let through as the single Half-Open trial, which closes the breaker if it succeeds and reopens it if it fails.",
      chooseWhen: [
        "A dependency can fail for a while and keep failing, and you want callers to stop contacting it and fail fast instead of waiting on every call.",
        "You want the system to notice recovery on its own, with a trial call after a cooldown, instead of someone flipping a switch.",
        "Callers have a sensible fallback for the Open state, because failing fast is still failing.",
      ],
      code: [
        { kind: "pattern", slug: "circuit-breaker", region: "openCheck" },
        { kind: "pattern", slug: "circuit-breaker", region: "halfOpenCheck" },
        { kind: "pattern", slug: "circuit-breaker", region: "onFailure" },
      ],
      steps: [
        { kind: "pattern", slug: "circuit-breaker", step: 3 },
        { kind: "pattern", slug: "circuit-breaker", step: 4 },
        { kind: "pattern", slug: "circuit-breaker", step: 5 },
      ],
    },
  ],
  noPattern: {
    when: "The service has one dependency, or calls are so few that nothing can fill the caller’s capacity, and a dependency that fails is simply retried or reported.",
    instead:
      "Set a timeout on every outgoing call and keep the existing shared limit or pool. Add a Bulkhead once a slow dependency has been seen to starve the others, and a Circuit Breaker once repeated failures keep costing callers time.",
  },
  overlap:
    "These patterns are complementary and are usually combined. A Bulkhead limits concurrent calls, but it frees a slot only when a call finishes, so the Bulkhead page recommends pairing it with timeouts, so that a call cannot hold a slot forever, and with a Circuit Breaker, which stops calling a dependency that keeps failing. Neither example includes the other pattern or any timeout, so these examples show each one in isolation. Resilience4j has a module for each pattern. In Polly for .NET, v7 has BulkheadPolicy and CircuitBreakerPolicy; in v8 the circuit breaker is AddCircuitBreaker, and concurrency is limited with AddConcurrencyLimiter from its rate-limiter package.",
  scenario: {
    prompt:
      "Checkout sends payments and recommendations calls through one shared pool of 20 concurrent calls. Recommendations has started to answer very slowly, its calls stay in flight, and payments calls are now refused because the pool is full of waiting recommendations calls. What should you add first?",
    choices: [
      {
        id: "bulkhead",
        option: "bulkhead",
        label: "A Bulkhead per dependency, with its own limit for recommendations",
        verdict: "best",
        explanation:
          "The problem is concurrency: slow calls hold slots, and one shared limit lets recommendations take the slots that payments needs. A separate compartment means recommendations can fill only its own slots and is rejected there, while payments still starts its calls. This is the same shape as the shared run versus the isolated run in the Bulkhead example. Still add timeouts, so that a call cannot hold a slot forever.",
      },
      {
        id: "circuit-breaker",
        option: "circuit-breaker",
        label: "A Circuit Breaker around the recommendations calls",
        verdict: "workable",
        explanation:
          "A breaker reacts to failures. If the slow calls end in errors, such as timeouts, it will eventually open and stop recommendations calls from holding slots. But the example breaker counts only calls that fail, so slow calls that still succeed would never trip it, and it does not reserve capacity for payments. Until it opens, recommendations can still take the whole shared pool.",
      },
      {
        id: "bigger-pool",
        option: "none",
        label: "Make the shared pool bigger",
        verdict: "poor",
        explanation:
          "A larger shared limit only delays the problem. New recommendations calls keep arriving while old ones are still in flight, so the slow dependency can still fill the pool, and payments is refused again. The limit has to be split per dependency, not raised for everything.",
      },
    ],
  },
};
