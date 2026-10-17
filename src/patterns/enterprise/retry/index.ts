import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { RetryVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "retry",
  name: "Retry",
  category: "enterprise",
  order: 23,
  summary:
    "Call again after a transient failure, letting the longest allowed wait grow each time, and taking a random share of it (jitter) so many clients do not retry in step.",
  intent:
    "Hide short-lived failures from the caller by repeating the call a limited number of times, waiting between attempts (the longest allowed wait, the ceiling, grows each time; the jittered wait actually used need not), and stop at once when the failure is not the kind that a repeat can fix.",
  problem:
    "A call to another service fails for a moment: a 503 while an instance restarts, a dropped connection, a brief overload. If every caller reports that failure upward, users see errors that would have gone away a fraction of a second later. If every caller retries at once and without limit, the retries pile onto a dependency that is already struggling, and all the clients that failed together retry together.",
  solution:
    "Put a Retrier between the caller and the service. It runs the call and sorts the failure: in this example's policy a status below 500 is returned at once as not retryable and a 5xx status is treated as transient. That is a simplification, not a general HTTP rule: 408 (request timeout) and 429 (too many requests) often deserve a retry, so real policies list the retryable statuses explicitly. After a transient failure the Retrier asks the RetryPolicy for a ceiling (here 100ms, 200ms, 400ms: the base doubled for each attempt, never above the cap), takes a share of that ceiling from the Jitter, and asks the Sleeper to wait that long. After the last allowed attempt it gives up and returns the final status. The result is an Outcome that says whether the call succeeded, how many attempts it took and how long it waited, so the caller handles one value in every language (the service reports its failure as a thrown error in TypeScript, C# and Python and as a returned error value in Go). The example is deliberately simplified. The jitter is scripted (50, 25, 75, 40, 90, 10 percent, in that order) so that every run prints the same lines, whereas a real client draws it at random; full jitter is a uniform pick between 0 and the ceiling, which spreads clients out. The sleeper is fake: it adds up the time instead of waiting. The cap of 400ms never lowers a ceiling in this script (the ceilings are 100, 200 and 400, and 400 equals the cap); with a fifth attempt it would hold the ceiling at 400. Per-attempt timeouts are not shown.",
  analogy:
    "Redialling a busy phone number. You do not hang up for good after the first busy tone, and you do not redial every second either: you wait a bit, try again, wait longer, and give up after a few tries. If the line says the number does not exist, you stop at once, because redialling cannot help.",
  whenToUse: [
    "Calls cross a network and fail for short moments: restarts, brief overload, dropped connections, rate limits that clear.",
    "The operation is idempotent, such as the GET in this example, so doing it twice has the same effect as doing it once. A retried non-idempotent call (a payment, say) can apply twice unless it carries an idempotency key.",
    "Waiting a few hundred milliseconds is acceptable to the caller, and a slow answer is better than an error.",
    "Not when the failure is permanent (a 400, a 404, a bad credential): classify it and stop instead.",
  ],
  pros: [
    "Hides most short-lived failures from callers without any change to the service.",
    "Growing delays give a struggling dependency room to recover instead of hitting it again at once.",
    "Jitter spreads out clients that failed together, so they do not all retry at the same instant.",
    "The policy is plain data (attempts, base, cap), so it is easy to tune per dependency, and the injected Sleeper and Jitter make the behaviour testable without real time or randomness.",
  ],
  cons: [
    "Retries multiply load. If every layer in a call chain retries 3 times, one user request can become dozens of calls to the bottom service, and a dependency that is down is hit hardest at the worst moment (a retry storm). Pair retries with a Circuit Breaker, or limit them with a retry budget.",
    "Unsafe for non-idempotent calls without an idempotency key, because the first attempt may have worked even though the answer was lost.",
    "Adds latency to the unlucky calls: in this example call 1 waits 400ms and call 2 waits 260ms before the outcome is known.",
    "Retrying a permanent failure only wastes time, so the classification of failures (here: a status below 500 is not retryable, which would also reject a 429 that a real policy would retry) has to be right.",
    "This example shows no per-attempt timeout and a simple status-based classification. Real systems also retry on timeouts and connection errors, and some honour a Retry-After header.",
  ],
  realWorld: [
    "Polly for .NET (v8 resilience pipelines via AddRetry, with exponential backoff and jitter options)",
    "Resilience4j's Retry module for the JVM",
    "AWS SDKs, which retry throttled and 5xx responses with exponential backoff and jitter by default",
    "gRPC retry policies and Envoy or Istio route retry settings (maximum retries and back-off intervals)",
  ],
  related: ["circuit-breaker", "bulkhead", "sidecar"],
  Visualization: RetryVisualization,

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 85,
      y: 100,
      description:
        "Hands a call to the Retrier and receives an Outcome. It contains no loop, no delay and no knowledge of which statuses are transient.",
      code: "client",
    },
    {
      id: "retrier",
      label: "Retrier",
      role: "Context",
      kind: "class",
      x: 340,
      y: 100,
      width: 150,
      description:
        "Runs the call, sorts a failure into retryable or not, waits between attempts and gives up after the last one. It never sleeps after the last attempt. It returns an Outcome (ok, attempts, waited milliseconds, final status) instead of throwing when the service reports an API error (any other error is passed on), so all four languages hand the caller the same kind of value.",
      code: "retrier",
    },
    {
      id: "service",
      label: "FlakyService",
      role: "Remote service",
      kind: "class",
      x: 640,
      y: 100,
      width: 150,
      description:
        "GET /inventory, an idempotent call. A script says which status each call gets; the last status repeats. A status of 400 or above is reported as an API error (thrown in TypeScript, C# and Python, returned as an error value in Go). A new service is created for each call in the usage.",
      code: "service",
    },
    {
      id: "policy",
      label: "RetryPolicy",
      role: "Policy",
      kind: "class",
      x: 160,
      y: 260,
      width: 150,
      description:
        "Holds max attempts (4), base delay (100ms) and cap (400ms). ceilingMs(n) is the base doubled for each attempt, never above the cap: 100, 200, 400. Here the cap never lowers a ceiling (the third ceiling, 400, equals it); it would hold a fifth attempt at 400.",
      code: "policy",
    },
    {
      id: "jitter",
      label: "ScriptedJitter",
      role: "Jitter source",
      kind: "object",
      x: 360,
      y: 260,
      width: 150,
      description:
        "Hands out a percentage from the script 50, 25, 75, 40, 90, 10, in order, and never starts over. The script is only there so every run prints the same lines; a real client draws a random share (full jitter: uniform between 0 and the ceiling).",
      code: "jitter",
    },
    {
      id: "sleeper",
      label: "FakeSleeper",
      role: "Sleeper",
      kind: "object",
      x: 560,
      y: 260,
      width: 150,
      description:
        "A fake: sleep(ms) only adds to a running total and returns at once, so the example runs instantly. A real sleeper would wait (or schedule the next attempt).",
      code: "sleeper",
    },
  ],
  relations: [
    {
      id: "call",
      from: "client",
      to: "retrier",
      type: "calls",
      label: "execute(fn)",
      description: "The client passes the work to do as a function and gets an Outcome back.",
      code: "retrier",
    },
    {
      id: "invoke",
      from: "retrier",
      to: "service",
      type: "calls",
      label: "get()",
      description:
        "Each attempt calls the service once. A success ends the loop; a failure is classified.",
      code: "attempt",
    },
    {
      id: "backoff",
      from: "retrier",
      to: "policy",
      type: "calls",
      label: "ceilingMs(n)",
      description: "After a retryable failure the Retrier asks how long the longest wait may be.",
      code: "wait",
    },
    {
      id: "jitterPick",
      from: "retrier",
      to: "jitter",
      type: "calls",
      label: "nextPercent()",
      description:
        "The Retrier takes a share of the ceiling: delay = ceiling x percent / 100, rounded down.",
      code: "wait",
    },
    {
      id: "sleep",
      from: "retrier",
      to: "sleeper",
      type: "calls",
      label: "sleep(ms)",
      description: "The Retrier waits by asking the Sleeper, never by sleeping itself.",
      code: "wait",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Call 1: the first attempt fails",
      description:
        "The client calls retrier.execute(fn). Attempt 1 reaches FlakyService, which answers 503 (call 1 is scripted 503, 503, 503, then 200).",
      highlight: ["client", "call", "retrier", "invoke", "service"],
      packets: [
        { relation: "call", label: "execute(fn)" },
        { relation: "invoke", label: "get()", after: 0 },
        { relation: "invoke", label: "503", reverse: true, after: 1 },
      ],
      notes: { retrier: "attempt 1/4", service: "503" },
      code: "attempt",
    },
    {
      title: "A 503 is transient: wait up to 100ms",
      description:
        "503 is not below 500, so the Retrier treats it as transient. The policy gives a ceiling of 100ms, the jitter says 50%, so the delay is floor(100 x 50 / 100) = 50ms, and the Sleeper is asked to wait that long.",
      highlight: ["retrier", "backoff", "policy", "jitterPick", "jitter", "sleep", "sleeper"],
      packets: [
        { relation: "backoff", label: "ceilingMs(1) = 100" },
        { relation: "jitterPick", label: "50%", after: 0 },
        { relation: "sleep", label: "sleep(50)", after: 1 },
      ],
      notes: { policy: "ceiling 100ms", jitter: "50%", sleeper: "slept 50ms" },
      code: "wait",
    },
    {
      title: "Attempt 2 fails: ceiling 200ms",
      description:
        "The second attempt also gets 503. The ceiling doubles to 200ms, the jitter says 25%, so the wait is 50ms.",
      highlight: ["invoke", "service", "backoff", "jitterPick", "sleep", "sleeper"],
      packets: [
        { relation: "invoke", label: "get()" },
        { relation: "invoke", label: "503", reverse: true, after: 0 },
        { relation: "backoff", label: "ceilingMs(2) = 200", after: 1 },
        { relation: "jitterPick", label: "25%", after: 2 },
        { relation: "sleep", label: "sleep(50)", after: 3 },
      ],
      notes: {
        retrier: "attempt 2/4",
        policy: "ceiling 200ms",
        jitter: "25%",
        sleeper: "slept 100ms",
      },
      code: "wait",
    },
    {
      title: "Attempt 3 fails: ceiling 400ms",
      description:
        "The third attempt gets 503 again. The ceiling is 400ms (100 x 4, which happens to equal the cap, so the cap does not limit anything yet), the jitter says 75%, so the wait is 300ms.",
      highlight: ["invoke", "service", "backoff", "jitterPick", "sleep", "sleeper"],
      packets: [
        { relation: "invoke", label: "get()" },
        { relation: "invoke", label: "503", reverse: true, after: 0 },
        { relation: "backoff", label: "ceilingMs(3) = 400", after: 1 },
        { relation: "jitterPick", label: "75%", after: 2 },
        { relation: "sleep", label: "sleep(300)", after: 3 },
      ],
      notes: {
        retrier: "attempt 3/4",
        policy: "ceiling 400ms",
        jitter: "75%",
        sleeper: "slept 400ms",
      },
      code: "wait",
    },
    {
      title: "Attempt 4 succeeds",
      description:
        "The fourth attempt is answered with success. The Retrier returns an Outcome of ok, 4 attempts, 400ms waited (50 + 50 + 300).",
      highlight: ["retrier", "invoke", "service", "call"],
      packets: [
        { relation: "invoke", label: "get()" },
        { relation: "invoke", label: "ok", reverse: true, after: 0 },
        { relation: "call", label: "ok, 4 attempts", reverse: true, after: 1 },
      ],
      notes: { retrier: "ok, waited 400ms", service: "ok" },
      code: "attempt",
    },
    {
      title: "Call 2: a service that keeps failing",
      description:
        "A new call, with a new service that always answers 503. Attempts 1 to 3 fail and the jitter continues where it left off (40%, 90%, 10%), so the waits are 40ms, 180ms and 40ms for ceilings of 100, 200 and 400ms.",
      highlight: ["call", "invoke", "service", "backoff", "jitterPick", "sleep"],
      packets: [
        { relation: "call", label: "execute(fn)" },
        { relation: "invoke", label: "get()", after: 0 },
        { relation: "invoke", label: "503", reverse: true, after: 1 },
        { relation: "backoff", label: "ceilingMs(1) = 100", after: 2 },
        { relation: "jitterPick", label: "40%", after: 3 },
        { relation: "sleep", label: "sleep(40)", after: 4 },
        { relation: "invoke", label: "get()", after: 5 },
        { relation: "invoke", label: "503", reverse: true, after: 6 },
        { relation: "backoff", label: "ceilingMs(2) = 200", after: 7 },
        { relation: "jitterPick", label: "90%", after: 8 },
        { relation: "sleep", label: "sleep(180)", after: 9 },
        { relation: "invoke", label: "get()", after: 10 },
        { relation: "invoke", label: "503", reverse: true, after: 11 },
        { relation: "backoff", label: "ceilingMs(3) = 400", after: 12 },
        { relation: "jitterPick", label: "10%", after: 13 },
        { relation: "sleep", label: "sleep(40)", after: 14 },
      ],
      notes: { retrier: "attempt 3/4", jitter: "40%, 90%, 10%" },
      code: "wait",
    },
    {
      title: "Attempt 4 fails: give up",
      description:
        "Attempt 4 is the last one allowed, so the Retrier does not wait again. It gives up with the final status: gave up (503), 4 attempts, 260ms waited (40 + 180 + 40).",
      highlight: ["retrier", "invoke", "service", "call"],
      packets: [
        { relation: "invoke", label: "get()" },
        { relation: "invoke", label: "503", reverse: true, after: 0 },
        { relation: "call", label: "gave up (503)", reverse: true, after: 1 },
      ],
      notes: { retrier: "gave up, waited 260ms", service: "503" },
      code: "giveUp",
    },
    {
      title: "Call 3: a 400 is not retried",
      description:
        "The service answers 400. That status is below 500, so in this example's policy it is not retried (a 400 is a request that repeating will not fix): the Retrier returns at once (failed, 1 attempt, 0ms waited) and asks nobody for a ceiling or a jitter value.",
      highlight: ["call", "invoke", "service"],
      packets: [
        { relation: "call", label: "execute(fn)" },
        { relation: "invoke", label: "get()", after: 0 },
        { relation: "invoke", label: "400", reverse: true, after: 1 },
        { relation: "call", label: "not retryable", reverse: true, after: 2 },
      ],
      notes: { retrier: "not retryable, waited 0ms", service: "400" },
      code: "classify",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
