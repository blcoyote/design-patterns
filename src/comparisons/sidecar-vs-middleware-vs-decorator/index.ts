/**
 * Sidecar, Middleware and Decorator all add cross-cutting behaviour around code that stays
 * unchanged. They differ in where the added behaviour runs and who wires it in. Every claim below
 * was checked against `src/patterns/enterprise/sidecar`, `src/patterns/enterprise/middleware` and
 * `src/patterns/structural/decorator` (index.ts and all four language examples). The Sidecar
 * example simulates its process boundary, so statements about real sidecars are attributed to the
 * Sidecar page rather than to the example. The Decorator pattern is also compared with Adapter and
 * Facade in `adapter-vs-facade-vs-decorator`; this page stays on the question of where the
 * wrapping lives.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "sidecar-vs-middleware-vs-decorator",
  title: "Sidecar vs Middleware vs Decorator",
  order: 16,
  summary:
    "All three add behaviour around existing code without editing it. They differ in where it runs (a separate process or inside the app), how it is composed, and who configures it.",
  subjects: [
    { kind: "pattern", slug: "sidecar" },
    { kind: "pattern", slug: "middleware" },
    { kind: "pattern", slug: "decorator" },
  ],
  problem:
    "Calls need extra behaviour around them, such as an identity header, a retry, a log line, a cache or a price add-on, and the code that does the real work should not be edited to carry it. Decorator, Middleware and Sidecar can all wrap that code. The decision is where the wrapping lives: around one object, in a pipeline inside the app, or in a separate helper deployed next to the app.",
  constraints: [
    "Must the behaviour work for services written in several languages, or is one language enough?",
    "Can the app be rebuilt and redeployed to change the behaviour, or must the behaviour change on its own?",
    "Does the behaviour need an ordered list of steps that each act before and after the call, or is one wrapper enough?",
    "Who owns the behaviour: the developers of one app, or a platform team that runs many services?",
    "Is an extra process and an extra hop on each call acceptable, or is the latency and the operational cost too high?",
  ],
  dimensions: [
    {
      label: "Where it runs",
      values: {
        sidecar:
          "In real systems, a separate process or container deployed next to each service instance. In this example the process boundary is simulated: the app and the Sidecar are two objects in one process and the call between them is a method call.",
        middleware:
          "Inside the app's own process. Each step reaches the rest of the pipeline through the next call, which is an ordinary function call.",
        decorator:
          "Inside the app's own process. Each decorator holds the object it wraps and calls it directly.",
      },
    },
    {
      label: "What it wraps",
      values: {
        sidecar:
          "The app's outbound calls. In this example OrderService sends requests through the outbound interface it was handed, and the Sidecar sends them on to its upstream.",
        middleware:
          "A request handler. Every step takes the same request and the rest of the pipeline, and the handler does not know the steps exist.",
        decorator:
          "One object behind its interface. SugarDecorator and MilkDecorator implement the same Coffee interface as SimpleCoffee.",
      },
    },
    {
      label: "Language independence",
      values: {
        sidecar:
          "A real sidecar is not tied to the service's language: the app only needs to make a network call, so one sidecar can serve services written in different languages (the Sidecar page explains this; the example shows one language at a time).",
        middleware:
          "None. The steps are written in the app's language against the pipeline's request and response types, so a polyglot system needs a version for each language.",
        decorator:
          "None. A decorator is written in the app's language against the wrapped interface, so a polyglot system needs a version for each language.",
      },
    },
    {
      label: "Does the app's code change",
      values: {
        sidecar:
          "A real mesh redirects the app's traffic to the sidecar transparently, so the app code does not change. In this example the Sidecar is handed to OrderService explicitly, so the wiring is a change in the usage code, while OrderService itself holds no identity, retry or metrics code.",
        middleware:
          "The handler is unchanged, but something must build the pipeline and call it. The usage code does this by listing the steps and the handler.",
        decorator:
          "The wrapped class is unchanged, but the caller must build the stack, as the usage code does by wrapping SimpleCoffee in MilkDecorator and then in SugarDecorator.",
      },
    },
    {
      label: "Ordering and composition",
      values: {
        sidecar:
          "This example has one Sidecar, so nothing is ordered across several helpers. Inside its send call the order is fixed: count the request, add the identity header, make attempts, then update the counters.",
        middleware:
          "An ordered list, composed once around the handler. The first step is outermost, each step can act before the call, after it, or answer on its own without calling the rest, and the order is part of the behaviour: the cache placed before auth lets an anonymous request through.",
        decorator:
          "Stacked by the caller in the order of wrapping. The outermost decorator is called first and delegates inward. The decorators in this example call the wrapped object and add their own part to the result; the Decorator page notes that the order of wrapping matters.",
      },
    },
    {
      label: "Who configures it",
      values: {
        sidecar:
          "In the example, the usage code plays the operator and calls the config reload to set max retries to 0, with no change to OrderService. The Sidecar page says that in a real mesh such settings usually come from a control plane.",
        middleware:
          "The developers of the app, in code: the list passed to the pipeline function decides which steps run and in what order.",
        decorator:
          "The developers of the app, in code: whoever constructs the stack chooses which decorators wrap the object, and can do so at runtime.",
      },
    },
    {
      label: "Main cost",
      values: {
        sidecar:
          "Per the Sidecar page: an extra process for each instance, an extra local hop on each call that goes through it, and more to upgrade and debug. The example cannot show these because its process boundary is simulated.",
        middleware:
          "Hidden control flow, because reading the handler does not show what runs around it. Each step also adds a call frame, so a long pipeline makes stack traces deeper.",
        decorator:
          "Many small objects that look alike, which can be hard to debug, and wrapping order that is easy to get wrong.",
      },
    },
  ],
  options: [
    {
      subject: "sidecar",
      changes:
        "OrderService sends its stock request to the outbound interface it was given, and that is the Sidecar. The Sidecar adds the x-client-identity header to a copy of the request, retries a 503 while it is within max retries, and keeps the counters. Changing max retries is a call on the Sidecar, and OrderService is not touched. The example simulates the process boundary, hands the Sidecar to the app explicitly, and uses a plain header in place of mutual TLS. This sidecar handles only the app's outbound calls, which is the outbound-only form known as Ambassador; real sidecars often also handle inbound traffic, log shipping or configuration.",
      chooseWhen: [
        "Many services, possibly in several languages, need the same behaviour, and keeping a library in step for each language costs too much.",
        "The behaviour must change without rebuilding and redeploying each service.",
        "The service code cannot or should not be changed, for example a legacy or third-party service.",
        "The platform can run a helper next to each instance, and the extra process and hop are acceptable.",
      ],
      code: [
        { kind: "pattern", slug: "sidecar", region: "sidecar" },
        { kind: "pattern", slug: "sidecar", region: "app" },
        { kind: "pattern", slug: "sidecar", region: "usage" },
      ],
      steps: [
        { kind: "pattern", slug: "sidecar", step: 0 },
        { kind: "pattern", slug: "sidecar", step: 3 },
        { kind: "pattern", slug: "sidecar", step: 4 },
      ],
    },
    {
      subject: "middleware",
      changes:
        "The pipeline function wraps the handler in the logging, auth and cache middlewares from last to first, so logging is outermost. A request passes inward and the response travels back out through the same steps. Auth can answer 401 itself without calling the rest of the pipeline, and the cache can answer from memory. All of it runs inside the app's process, built by the app's own code.",
      chooseWhen: [
        "Several handlers in one app share steps such as logging, authentication, caching or error mapping.",
        "A step needs to act on both the request and the response, or to stop the request and answer it itself.",
        "The steps and their order should be changeable by editing the list that builds the pipeline.",
        "One language is enough and a separate process is not wanted.",
      ],
      code: [
        { kind: "pattern", slug: "middleware", region: "pipeline" },
        { kind: "pattern", slug: "middleware", region: "authReject" },
        { kind: "pattern", slug: "middleware", region: "reorder" },
      ],
      steps: [
        { kind: "pattern", slug: "middleware", step: 0 },
        { kind: "pattern", slug: "middleware", step: 6 },
        { kind: "pattern", slug: "middleware", step: 7 },
      ],
    },
    {
      subject: "decorator",
      changes:
        "MilkDecorator and SugarDecorator implement the same Coffee interface as SimpleCoffee, and each holds the coffee it wraps. The caller stacks them, and calling the cost method on the outermost one delegates inward and adds each decorator's part on the way out, giving 2.75. This is one object wrapped in one process, with no pipeline and no separate helper.",
      chooseWhen: [
        "Behaviour is added to individual objects, and wrappers should be combined at runtime.",
        "The wrapper must keep exactly the interface of the object it wraps, so callers cannot tell the difference.",
        "Each add-on is small and does one job, and a type for every combination would multiply quickly.",
        "You are wrapping one object rather than a request handler, so a pipeline of steps has nothing to standardise.",
      ],
      code: [
        { kind: "pattern", slug: "decorator", region: "coffeeDecorator" },
        { kind: "pattern", slug: "decorator", region: "sugarDecorator" },
        { kind: "pattern", slug: "decorator", region: "usage" },
      ],
      steps: [
        { kind: "pattern", slug: "decorator", step: 0 },
        { kind: "pattern", slug: "decorator", step: 4 },
      ],
    },
  ],
  noPattern: {
    when: "One call site needs one extra behaviour, and no other service or handler shares it.",
    instead:
      "Put the code in the function that makes the call, or in a small helper that function calls. Reach for a Decorator when wrappers combine, for Middleware when several handlers share ordered steps, and for a Sidecar only when the behaviour must be shared across services or languages or changed without redeploying them.",
  },
  overlap:
    "These patterns are complementary and are often used together. Middleware is the same wrap-the-rest idea as stacking decorators, with one standard shape for every step; the Decorator page lists HTTP middleware chains among its real-world uses. The Sidecar page contrasts itself with both: Middleware and Decorator wrap calls inside the app's process and need the app code or a library for each language, whereas a sidecar is a separate process that needs no change to the app. Because they work at different levels, an app can use a Middleware pipeline or a Decorator inside its own process for what is specific to it, and a sidecar next to it for what the platform provides for every service.",
  scenario: {
    prompt:
      "A platform team runs thirty services written in Go, Java and Python. Every outbound call must carry the calling service's identity and retry a transient 503, and the retry limit must be changeable without rebuilding any service. The team can run a helper container next to each instance. Which fits best?",
    choices: [
      {
        id: "sidecar",
        option: "sidecar",
        label: "A Sidecar deployed next to each instance",
        verdict: "best",
        explanation:
          "The behaviour is shared by services in several languages and must change without redeploying them, which is the case the Sidecar page lists. The helper adds the identity and retries, and a setting such as max retries can change in the helper while the services stay as they are. The cost is an extra process and hop per instance, and a real mesh redirects traffic transparently where this example hands the Sidecar to the app explicitly.",
      },
      {
        id: "middleware-library",
        option: "middleware",
        label: "A Middleware pipeline in each service's HTTP client",
        verdict: "workable",
        explanation:
          "It works inside each service, and the steps can be reordered by editing the list. But the steps must be written once for each of the three languages, and changing the retry behaviour means changing and redeploying every service, unless each one is built to reload it from outside. That is the cost that makes the Sidecar the better fit here.",
      },
      {
        id: "decorator-client",
        option: "decorator",
        label: "A Decorator around each service's outbound client",
        verdict: "workable",
        explanation:
          "A decorator that keeps the client's interface can add the identity and the retry without changing the client. It is the same in-process approach as Middleware, so it needs a version for each language, and changing the policy means changing and redeploying each service unless each one can reload it from outside.",
      },
      {
        id: "copy-paste",
        option: "none",
        label: "Put the identity and retry code directly in every service",
        verdict: "poor",
        explanation:
          "This repeats the plumbing in every service and language, the copies drift apart, and every change means changing and redeploying the services. This is the problem the Sidecar page describes.",
      },
    ],
  },
};
