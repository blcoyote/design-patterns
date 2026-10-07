import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { MiddlewareVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "middleware",
  name: "Middleware (Pipeline)",
  category: "enterprise",
  order: 15,
  summary:
    "Stack steps around a handler so each can act before and after the rest, or answer the request itself and stop it.",
  intent:
    "Build a request-handling pipeline out of small, reusable steps. Each step receives the request and a way to call the rest of the pipeline. It can do work before the call, work after it returns, or decline to call it at all and answer on its own. The steps are composed once, in an order you choose, around the real handler.",
  problem:
    "Every request to a report endpoint needs logging, an authentication check and a cache, and the real work is a few lines. Putting all of that inside the handler buries the work under cross-cutting code, and every other endpoint has to copy it. A chain of handlers can do this too, but it leaves the shape of each link up to the author. Middleware makes one around-the-call contract standard: every step is given the rest of the pipeline as something it may call, and decides whether, when and what to do with the response.",
  solution:
    "Give each concern its own middleware with the same shape: it takes the request and the rest of the pipeline. A pipeline function wraps the handler in the middlewares from last to first, so the first one in the list is outermost. A request passes inward through each middleware, reaches the handler, and the response travels back out through the same middlewares in reverse. The logging step prints a line before passing the request on and another when the response comes back. The authentication step answers 401 itself when there is no token and never passes the request on. The cache step answers from memory when it has the path and otherwise lets the request through and stores the result.",
  analogy:
    "Layers of an onion, or a security checkpoint on the way into a building: each layer can check you on the way in, and some also stamp your pass on the way out. A checkpoint can also turn you away, and then nothing deeper ever sees you. If the order of the checkpoints changes, so does who gets in.",
  whenToUse: [
    "Several endpoints or handlers need the same cross-cutting behaviour, such as logging, authentication, caching, retries or error mapping.",
    "A step needs to act on both the request and the response, for example to time the call or to translate an error.",
    "Steps should be able to stop the request early and answer it themselves.",
    "You want to add, remove or reorder steps through configuration without touching the handler.",
  ],
  pros: [
    "Cross-cutting concerns live in small, independent steps that every handler can reuse.",
    "Each step can act on the request on the way in and on the response on the way out, around the same call.",
    "A step can short-circuit, so expensive or forbidden work is skipped.",
    "The handler stays focused on its own job and knows nothing about the steps around it.",
  ],
  cons: [
    "The order is part of the behaviour. In this example, putting the cache before authentication lets an anonymous request read a cached response, and nothing flags the mistake.",
    "Control flow is hidden: reading the handler alone does not show what else runs around it, and a step that forgets to call the next one silently swallows the request.",
    "Each step adds a call frame, so a long pipeline makes stack traces deeper and harder to read.",
    "Steps share a single request and response shape, so they cannot pass much between each other without widening it.",
  ],
  realWorld: [
    "Express, Koa and Connect middleware (app.use)",
    "ASP.NET Core's request pipeline and HttpClient's DelegatingHandler",
    "Go's net/http handler wrappers",
    "Django and Rails (Rack) middleware",
    "Redux middleware and message-handler middleware in Wolverine and MassTransit",
  ],
  related: ["chain-of-responsibility", "decorator", "circuit-breaker", "cache-aside"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Sender",
      kind: "class",
      x: 110,
      y: 110,
      width: 150,
      description:
        "Sends requests to the pipeline and gets a response back. It only sees the outermost step and does not know how many steps there are.",
    },
    {
      id: "logging",
      label: "Logging",
      role: "Middleware 1 (outermost)",
      kind: "class",
      x: 400,
      y: 110,
      width: 170,
      description:
        "Logs the request, passes it on, and when the response comes back logs its status. It needs both sides of the call, so it is written around the call to the rest of the pipeline.",
    },
    {
      id: "auth",
      label: "Auth",
      role: "Middleware 2",
      kind: "class",
      x: 690,
      y: 110,
      width: 150,
      description:
        "Lets a request through only if it carries a token. With no token it answers 401 itself and does not pass the request on, so the steps behind it never run.",
    },
    {
      id: "cache",
      label: "Cache",
      role: "Middleware 3",
      kind: "class",
      x: 690,
      y: 350,
      width: 150,
      description:
        "Answers from memory when it already has a response for the path, and otherwise passes the request on and stores a successful response. It is keyed by path only, so it does not know who is asking and must sit behind authentication.",
    },
    {
      id: "handler",
      label: "Handler",
      role: "Final handler",
      kind: "class",
      x: 400,
      y: 350,
      width: 160,
      description:
        "The real work: it builds the report. It is wrapped by the middlewares and does not know they exist.",
    },
  ],
  relations: [
    {
      id: "request",
      from: "client",
      to: "logging",
      type: "calls",
      label: "request",
      description:
        "The client hands the request to the pipeline, which means to the outermost middleware. The response comes back along the same path.",
      code: "pipeline",
    },
    {
      id: "toAuth",
      from: "logging",
      to: "auth",
      type: "calls",
      label: "next",
      description:
        "Logging calls the rest of the pipeline, whose first step is authentication. When that call returns, logging still has a chance to act.",
      code: "logging",
    },
    {
      id: "toCache",
      from: "auth",
      to: "cache",
      type: "calls",
      label: "next",
      description:
        "Authentication calls the rest of the pipeline only if the request carries a token.",
      code: "auth",
    },
    {
      id: "toHandler",
      from: "cache",
      to: "handler",
      type: "calls",
      label: "next",
      description:
        "The cache calls the rest of the pipeline, which here is the handler, only when it has no stored response for the path.",
      code: "cache",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "The pipeline wraps the handler",
      description:
        "The pipeline function wraps the handler in the middlewares from last to first: cache around the handler, auth around that, logging around all of it. Logging is outermost, so it sees every request first and every response last.",
      highlight: ["logging", "auth", "cache", "handler"],
      notes: { logging: "outermost", handler: "innermost" },
      code: "pipeline",
    },
    {
      title: "The request goes in through logging",
      description:
        "The client sends GET /report with a valid token. Logging records the request, then passes it on to the next step.",
      highlight: ["client", "request", "logging", "toAuth", "auth"],
      packets: [
        { relation: "request", label: "/report + token" },
        { relation: "toAuth", label: "next", after: 0 },
      ],
      notes: { logging: "log: -> /report" },
      code: "logging",
    },
    {
      title: "Auth lets it through",
      description:
        "The request has a token, so auth accepts it and passes it on. Had the token been missing, the request would have stopped here.",
      highlight: ["auth", "toCache", "cache"],
      packets: [{ relation: "toCache", label: "token ok" }],
      code: "auth",
    },
    {
      title: "A cache miss reaches the handler",
      description:
        "The cache has nothing stored for /report, so it passes the request to the handler. The handler builds the report and returns a 200.",
      highlight: ["cache", "toHandler", "handler"],
      packets: [
        { relation: "toHandler", label: "next" },
        { relation: "toHandler", label: "200", reverse: true, after: 0 },
      ],
      notes: { cache: "miss", handler: "building /report" },
      code: "cache",
    },
    {
      title: "The response travels back out",
      description:
        "The 200 goes back through the same steps in reverse. The cache stores it, and logging, which has been waiting since the start, now logs the status. Code after the call to the next step is how a middleware acts on the response.",
      highlight: ["cache", "toCache", "auth", "toAuth", "logging", "request", "client"],
      packets: [
        { relation: "toCache", label: "200", reverse: true },
        { relation: "toAuth", label: "200", reverse: true, after: 0 },
        { relation: "request", label: "200", reverse: true, after: 1 },
      ],
      notes: { cache: "stored /report", logging: "log: <- 200" },
      code: "logAfter",
    },
    {
      title: "A cache hit stops the request early",
      description:
        "The same request arrives again. Logging and auth pass it on as before, but the cache now has the path stored, so it answers itself and never calls the handler. The response still travels back out through auth and logging.",
      highlight: ["client", "request", "logging", "toAuth", "auth", "toCache", "cache"],
      packets: [
        { relation: "request", label: "/report + token" },
        { relation: "toAuth", label: "next", after: 0 },
        { relation: "toCache", label: "next", after: 1 },
        { relation: "toCache", label: "200 (cached)", reverse: true, after: 2 },
        { relation: "toAuth", label: "200", reverse: true, after: 3 },
        { relation: "request", label: "200", reverse: true, after: 4 },
      ],
      notes: { cache: "hit", handler: "not called" },
      code: "cacheHit",
    },
    {
      title: "Auth can answer without going deeper",
      description:
        "A request arrives with no token. Auth answers 401 itself and never calls the next step, so the cache and the handler do not run. Logging still sees the 401 on the way out.",
      highlight: ["client", "request", "logging", "toAuth", "auth"],
      packets: [
        { relation: "request", label: "no token" },
        { relation: "toAuth", label: "next", after: 0 },
        { relation: "toAuth", label: "401", reverse: true, after: 1 },
        { relation: "request", label: "401", reverse: true, after: 2 },
      ],
      notes: { cache: "skipped", handler: "skipped" },
      code: "authReject",
    },
    {
      title: "Order changes behaviour",
      description:
        "Build the pipeline with the cache before auth. A signed-in request now warms the cache, and an anonymous request for the same path is answered from the cache with a 200, because auth never runs. The same three steps in a different order is a security hole.",
      highlight: ["cache", "auth"],
      notes: { logging: "1st in", auth: "3rd in" },
      code: "reorder",
    },
    {
      title: "Steps around a handler",
      description:
        "Each step is small and does one job, and the pipeline decides how they nest. A step can act on the way in, on the way out, or stop the request, and the order in which you stack them is part of what the system does.",
      highlight: ["logging", "auth", "cache", "handler"],
      code: "pipeline",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  // Swaps the Auth and Cache boxes for the "Order changes behaviour" step.
  Visualization: MiddlewareVisualization,
};
