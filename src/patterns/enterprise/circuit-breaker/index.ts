import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { CircuitBreakerVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "circuit-breaker",
  name: "Circuit Breaker",
  category: "enterprise",
  order: 5,
  summary:
    "Stop hammering a failing dependency — fail fast until it has had a chance to recover.",
  intent:
    "Stop calling a failing dependency for a while so errors fail fast, then carefully try again to see if it has recovered.",
  problem:
    "A service you depend on starts timing out. Every caller still waits out the full timeout before giving up, so threads, connections and queues fill up with requests that will almost certainly fail. One failing dependency slows its caller, then the caller's callers, until the whole system is slow or down, even the parts that have nothing to do with the original problem.",
  solution:
    "Put a CircuitBreaker in front of every call to the dependency. While things are healthy it is Closed and simply passes calls through. Once failures reach a threshold, it trips to Open: every call is rejected immediately, and the dependency is not contacted at all. After a cooldown period it moves to Half-Open and lets exactly one trial call through. If that call succeeds, the breaker closes again. If it fails, the breaker goes straight back to Open for another cooldown.",
  analogy:
    "Think of the circuit breaker in a house. A short circuit could keep drawing current and burn the wiring, so the breaker trips and cuts the power. A real breaker waits for a person to flip it back once the fault is fixed. The software version resets itself: after a cooldown it lets one trial call through to check whether the problem is gone.",
  whenToUse: [
    "Calls cross a network to a dependency that can become slow or unavailable (another service, a database, a third-party API).",
    "A failing dependency could use up threads, connections or queues in the caller while everyone waits for timeouts.",
    "You want the system to notice recovery and resume on its own, without a human flipping a switch.",
  ],
  pros: [
    "Fails fast once a dependency is known to be unhealthy, instead of making every caller wait out a full timeout.",
    "Stops one dependency's failure from cascading and exhausting resources in everything upstream of it.",
    "Recovers by itself: a single Half-Open trial call is enough to notice that the dependency is healthy again.",
  ],
  cons: [
    "Adds another layer of state and settings (threshold, cooldown) that must be tuned for each dependency.",
    "A threshold that is too low can trip on a brief blip. One that is too high defeats the point of having a breaker.",
    "Callers need a sensible fallback for the Open state. Failing fast is still failing, and something has to handle it.",
  ],
  realWorld: [
    "Netflix Hystrix — the library that popularized the pattern for service-to-service calls",
    "Resilience4j's CircuitBreaker module for the JVM",
    "Polly for .NET (v8 resilience pipelines via AddCircuitBreaker; v7 CircuitBreakerPolicy)",
    "Envoy and Istio outlier detection, which ejects unhealthy upstream hosts from the load-balancing pool",
  ],
  related: ["state", "proxy", "decorator"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 85,
      y: 230,
      description:
        "Calls breaker.call(fn) whenever it needs RemoteService. It never talks to RemoteService directly, and never special-cases whether the breaker is open or closed.",
    },
    {
      id: "breaker",
      label: "CircuitBreaker",
      role: "Context",
      kind: "class",
      x: 340,
      y: 230,
      width: 170,
      description:
        "Wraps every call to RemoteService. Tracks a failure count and a current mode (Closed, Open or Half-Open) and decides, before each call, whether RemoteService gets touched at all. Here the modes are a simple enum switched on in one class, not separate State objects (see the State pattern) — fine at this size, worth revisiting if the transition logic grows.",
    },
    {
      id: "service",
      label: "RemoteService",
      role: "Protected dependency",
      kind: "class",
      x: 340,
      y: 410,
      width: 160,
      description:
        "The downstream dependency the breaker protects. It can start failing (timeouts, errors) under load, which is exactly what the breaker is watching for.",
    },
    {
      id: "closed",
      label: "Closed",
      role: "Mode: healthy",
      kind: "object",
      x: 640,
      y: 90,
      description:
        "The default mode. Calls pass straight through to RemoteService, and every success resets the failure count to zero.",
      code: "onSuccess",
    },
    {
      id: "open",
      label: "Open",
      role: "Mode: tripped",
      kind: "object",
      x: 640,
      y: 380,
      description:
        'Entered once failures reach the threshold. Every call is rejected immediately — "fails fast" — without ever reaching RemoteService, until the cooldown elapses.',
      code: "openCheck",
    },
    {
      id: "halfOpen",
      label: "Half-Open",
      role: "Mode: probing",
      kind: "object",
      x: 710,
      y: 230,
      description:
        "Entered automatically once the cooldown elapses. Exactly one trial call is allowed through: success closes the breaker, failure reopens it and restarts the cooldown.",
      code: "halfOpenCheck",
    },
  ],
  relations: [
    {
      id: "request",
      from: "client",
      to: "breaker",
      type: "calls",
      label: "call(fn)",
      description:
        "The client always calls the breaker, passing in the work it wants done. The breaker decides whether that work ever actually runs.",
      code: "call",
    },
    {
      id: "forward",
      from: "breaker",
      to: "service",
      type: "wraps",
      label: "fn()",
      description:
        "When the breaker allows the call through — Closed, or the single Half-Open trial — it invokes fn() against RemoteService and watches whether it resolves or throws.",
      code: "invoke",
    },
    {
      id: "state-closed",
      from: "breaker",
      to: "closed",
      type: "holds",
      label: "mode",
      description:
        "The breaker currently considers itself Closed: healthy, and forwarding every call.",
      code: "onSuccess",
    },
    {
      id: "state-open",
      from: "breaker",
      to: "open",
      type: "holds",
      label: "mode",
      description:
        "The breaker currently considers itself Open: tripped, and rejecting every call without reaching RemoteService.",
      code: "openCheck",
    },
    {
      id: "state-halfOpen",
      from: "breaker",
      to: "halfOpen",
      type: "holds",
      label: "mode",
      description:
        "The breaker currently considers itself Half-Open: cautiously letting one trial call through to test for recovery.",
      code: "halfOpenCheck",
    },
    {
      id: "trip",
      from: "closed",
      to: "open",
      type: "notifies",
      label: "threshold reached",
      description:
        "The failure count reaching failureThreshold is what flips the breaker from Closed to Open — a cooldown window starts the moment this happens.",
      bend: -50,
      code: "onFailure",
    },
    {
      id: "cooldown",
      from: "open",
      to: "halfOpen",
      type: "notifies",
      label: "cooldown elapsed",
      description:
        "On the next call after cooldownMs has passed since the trip, the breaker switches itself to Half-Open — no external caller triggers this directly, it is checked lazily when that call arrives.",
      bend: 40,
      code: "halfOpenCheck",
    },
    {
      id: "trial-success",
      from: "halfOpen",
      to: "closed",
      type: "notifies",
      label: "trial ok",
      description:
        "The single Half-Open trial call succeeds, so the breaker resets its failure count and returns to Closed.",
      bend: -30,
      code: "onSuccess",
    },
    {
      id: "trial-failure",
      from: "halfOpen",
      to: "open",
      type: "notifies",
      label: "trial fails",
      description:
        "The trial call fails, so the breaker gives up on recovery for now, goes straight back to Open, and restarts the cooldown.",
      bend: -40,
      code: "onFailure",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Healthy traffic flows through",
      description:
        "The client calls breaker.call(fn). The breaker is Closed, so it simply forwards the call to RemoteService and hands the result straight back.",
      highlight: [
        "client",
        "request",
        "forward",
        "service",
        "closed",
        "state-closed",
      ],
      packets: [
        { relation: "request", label: "call(fn)" },
        { relation: "forward", label: "fn()", after: 0 },
        { relation: "forward", label: "ok", reverse: true, after: 1 },
      ],
      notes: { breaker: "failures: 0/3", service: "healthy" },
      code: "call",
    },
    {
      title: "A failure ticks the counter",
      description:
        "RemoteService throws. The breaker stays Closed, but records the failure — one of the three it will tolerate before tripping.",
      highlight: ["forward", "service", "closed"],
      packets: [
        { relation: "forward", label: "fn()" },
        { relation: "forward", label: "error", reverse: true, after: 0 },
      ],
      notes: { breaker: "failures: 1/3", service: "failing" },
      code: "onFailure",
    },
    {
      title: "A second failure",
      description:
        "Another call reaches RemoteService and fails again. The breaker is now one failure away from its threshold.",
      highlight: ["forward", "service", "closed"],
      packets: [
        { relation: "forward", label: "fn()" },
        { relation: "forward", label: "error", reverse: true, after: 0 },
      ],
      notes: { breaker: "failures: 2/3", service: "failing" },
      code: "onFailure",
    },
    {
      title: "The third failure trips the breaker",
      description:
        "The failure count reaches the threshold of three. The breaker flips to Open and starts its cooldown window — no further call will reach RemoteService until that elapses.",
      highlight: ["forward", "trip", "open", "state-open"],
      packets: [
        { relation: "forward", label: "fn()" },
        { relation: "forward", label: "error", reverse: true, after: 0 },
        { relation: "trip", label: "3/3 ⇒ OPEN", after: 1 },
      ],
      notes: { breaker: "OPEN", service: "failing" },
      code: "onFailure",
    },
    {
      title: "Calls fail fast",
      description:
        "A new call arrives while the breaker is Open. It never reaches RemoteService at all — the breaker rejects it immediately, so the caller is not left waiting out a timeout.",
      highlight: ["client", "request", "open", "state-open"],
      packets: [
        { relation: "request", label: "call(fn)" },
        { relation: "request", label: "fail fast ⚡", reverse: true, after: 0 },
      ],
      notes: { breaker: "failing fast", service: "untouched" },
      code: "openCheck",
    },
    {
      title: "The cooldown elapses",
      description:
        "When the first call arrives after cooldownMs has passed, the breaker switches to Half-Open and lets that same call through as the single trial. It is willing to find out whether RemoteService has recovered — but only with that one call.",
      highlight: ["cooldown", "halfOpen", "state-halfOpen"],
      packets: [{ relation: "cooldown", label: "cooldown elapsed" }],
      notes: { breaker: "HALF_OPEN", halfOpen: "trial pending" },
      code: "halfOpenCheck",
    },
    {
      title: "One trial request gets through",
      description:
        "That call is allowed to reach RemoteService — Half-Open permits exactly one attempt, to test whether the dependency has actually recovered. Any other call arriving while it is in flight still fails fast.",
      highlight: [
        "request",
        "forward",
        "service",
        "halfOpen",
        "state-halfOpen",
      ],
      packets: [
        { relation: "request", label: "call(fn)" },
        { relation: "forward", label: "fn()", after: 0 },
      ],
      notes: { service: "recovered", halfOpen: "trial in flight" },
      code: "call",
    },
    {
      title: "The trial succeeds — the breaker closes",
      description:
        "RemoteService answers normally. The breaker resets its failure count to zero and returns to Closed, exactly as if nothing had ever gone wrong.",
      highlight: ["forward", "trial-success", "closed", "state-closed"],
      packets: [
        { relation: "forward", label: "ok", reverse: true },
        { relation: "trial-success", label: "⇒ CLOSED", after: 0 },
      ],
      notes: { breaker: "failures: 0/3", closed: "healthy again" },
      code: "onSuccess",
    },
    {
      title: "A later trial fails and reopens it",
      description:
        "Some time afterward, a fresh failure streak trips the breaker again. This time, once the cooldown ends, the trial call itself fails — Half-Open sends the breaker straight back to Open and restarts the cooldown, without ever fully closing.",
      highlight: ["forward", "trial-failure", "open", "state-open"],
      packets: [
        { relation: "forward", label: "error", reverse: true },
        { relation: "trial-failure", label: "⇒ OPEN", after: 0 },
      ],
      notes: { breaker: "OPEN", halfOpen: "trial failed" },
      code: "onFailure",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: CircuitBreakerVisualization,
};
