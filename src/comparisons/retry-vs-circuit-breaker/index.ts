/**
 * Retry and Circuit Breaker both react to a failed call to a dependency, which is why they get
 * mixed up. They answer different questions: Retry asks whether this call should be repeated and
 * after how long, a Circuit Breaker asks whether any call should be made at all right now. Every
 * claim below was checked against `src/patterns/enterprise/retry` and
 * `src/patterns/enterprise/circuit-breaker` (index.ts and all four language examples), not
 * against the patterns in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "retry-vs-circuit-breaker",
  title: "Retry vs Circuit Breaker",
  order: 17,
  summary:
    "Both react to a failed call. Retry repeats the call after a jittered wait under a growing ceiling; a Circuit Breaker stops making calls to a dependency that keeps failing.",
  subjects: [
    { kind: "pattern", slug: "retry" },
    { kind: "pattern", slug: "circuit-breaker" },
  ],
  problem:
    "A checkout service reads stock from an inventory service. Now and then inventory answers 503 for a moment, and sometimes it keeps failing for much longer. When a call fails, something has to decide whether to call again, how long to wait first, and whether to stop calling for a while.",
  constraints: [
    "Are the failures short-lived, so that the same call is likely to work a moment later, or can the dependency stay down for a long time?",
    "Is the call idempotent, so that doing it twice has the same effect as doing it once?",
    "Is it acceptable for the caller to wait a few hundred milliseconds to hide a failure, or should it learn about the failure at once?",
    "Should the decision be made per call, or remembered across calls and shared by all callers?",
    "Do you already have a timeout on each call? Neither example here ends a call that hangs.",
  ],
  dimensions: [
    {
      label: "The question it answers",
      values: {
        retry:
          "Should this call be repeated, and after how long? It looks at one call and its failed attempts.",
        "circuit-breaker":
          "Should any call be made right now? It looks at the recent record of the dependency and decides before the call.",
      },
    },
    {
      label: "What triggers it",
      values: {
        retry:
          "A failed attempt that is classified as transient. In this example a status of 500 or above is retried and a status below 500 is final, so the 400 in call 3 is not retried.",
        "circuit-breaker":
          "Failures: the failure count has reached the threshold of 3, and a success resets the count to zero. Every call that fails with an error is counted.",
      },
    },
    {
      label: "State it keeps",
      values: {
        retry:
          "Per call, only the attempt number, plus the policy data: 4 attempts at most, a base of 100 ms and a cap of 400 ms. The scripted jitter percentages (50, 25, 75, 40, 90, 10) are handed out in order and are not reset between calls.",
        "circuit-breaker":
          "Shared by every call: a mode (Closed, Open or Half-Open), a failure count and the time of the next allowed attempt, measured against the example’s fake clock.",
      },
    },
    {
      label: "What callers see",
      values: {
        retry:
          "A slower success: call 1 succeeds on attempt 4 after waiting 400 ms. If every attempt fails, the Outcome after attempt 4 is “gave up (503)”, after waiting 260 ms in call 2. A 400 comes back at once, after 1 attempt and 0 ms.",
        "circuit-breaker":
          "While the breaker is Open the call fails fast with “circuit open, failing fast”, the wrapped function never runs and nothing waits. While the single Half-Open trial is in flight, other calls also fail fast.",
      },
    },
    {
      label: "How it paces itself",
      values: {
        retry:
          "The ceiling doubles with each attempt (100, 200, 400 ms) and the wait is a jittered share of it, ceiling x percent / 100, rounded down. The cap of 400 ms does not lower any ceiling in this example, because the last ceiling used is 400 anyway.",
        "circuit-breaker":
          "One fixed cooldown of 4000 ms. After it, the next call is let through as the one trial call: success closes the breaker, failure reopens it for another cooldown.",
      },
    },
    {
      label: "What it does not do",
      values: {
        retry:
          "It has no memory between calls: call 2 makes its own 4 attempts, and a later call starts again at attempt 1. It has no per-attempt timeout, and repeating a call that is not idempotent can apply it twice. This example has no Circuit Breaker.",
        "circuit-breaker":
          "It never repeats a failed call itself: the caller gets the error. It has no growing wait and no jitter. This example has no Retry.",
      },
    },
  ],
  options: [
    {
      subject: "retry",
      changes:
        "A Retrier wraps the call. It runs the function, treats a status of 500 or above as transient and anything below as final, and after a transient failure asks the RetryPolicy for a ceiling, takes a jittered share of it and sleeps that long before the next attempt. After attempt 4 it gives up and returns the final status instead of sleeping again.",
      chooseWhen: [
        "Failures are short-lived (a restart, a brief overload), so the same call is likely to succeed a moment later.",
        "The call is idempotent, such as a GET, so a repeat cannot do harm.",
        "A wait of a few hundred milliseconds is better for the caller than an error.",
        "Permanent failures, such as a 400, can be told apart from transient ones and returned at once.",
      ],
      code: [
        { kind: "pattern", slug: "retry", region: "policy" },
        { kind: "pattern", slug: "retry", region: "wait" },
        { kind: "pattern", slug: "retry", region: "classify" },
        { kind: "pattern", slug: "retry", region: "giveUp" },
      ],
      steps: [
        { kind: "pattern", slug: "retry", step: 1 },
        { kind: "pattern", slug: "retry", step: 6 },
        { kind: "pattern", slug: "retry", step: 7 },
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
    when: "The call is a single idempotent read where an error shown to the user is fine, or the dependency runs in the same process and does not fail for a moment.",
    instead:
      "Report the failure and let the user try again. Add Retry once transient errors show up in the logs, and a Circuit Breaker once retries start to pile onto a dependency that stays down.",
  },
  overlap:
    "These patterns are complementary and are often combined. The Retry page lists retries multiplying load (a retry storm) as a cost and recommends pairing them with a Circuit Breaker or a retry budget. Neither example contains the other pattern, so these examples show each one in isolation. How to combine them is a design choice, and the examples do not settle it. One consequence is worth knowing: an open breaker rejects calls at once, so a Retrier placed around a breaker would see those fast failures and has to decide whether “circuit open” is worth retrying. Resilience4j has a module for each pattern, and Polly for .NET v8 offers both as AddRetry and AddCircuitBreaker.",
  scenario: {
    prompt:
      "Inventory restarts once a day and answers 503 for about a second. Last week it was down for 10 minutes, and every checkout hung while its calls kept being repeated. What should you add first?",
    choices: [
      {
        id: "retry",
        option: "retry",
        label: "Retry with a limited number of attempts, a growing ceiling and jitter",
        verdict: "best",
        explanation:
          "The daily blip is exactly what Retry hides: the call is repeated after a short wait and usually succeeds, and the jitter keeps many checkouts from retrying at the same instant. A 400 is returned at once, and after the last attempt the Retrier gives up, as call 2 does after waiting 260 ms. It does not answer the 10-minute outage by itself: every call would still make all its attempts. Add a Circuit Breaker for that once it matters.",
      },
      {
        id: "circuit-breaker",
        option: "circuit-breaker",
        label: "A Circuit Breaker around the inventory calls",
        verdict: "workable",
        explanation:
          "A breaker handles the long outage well: after 3 failures it opens, calls fail fast and nothing hangs. But it does nothing for the daily blip, because it never repeats a call: every failed call is an error for the checkout until the breaker has recovered, and failures during a short blip can also open it. Callers need a fallback for the Open state.",
      },
      {
        id: "unbounded-retry",
        option: "none",
        label: "Retry every failed call until it works, with no limit",
        verdict: "poor",
        explanation:
          "Without a limit a dependency that is down is called again and again, so checkouts hang and the retries add load to a service that is already struggling. The Retry example stops after 4 attempts and returns a result. Unbounded retrying is also what the Circuit Breaker is meant to cut short.",
      },
    ],
  },
};
