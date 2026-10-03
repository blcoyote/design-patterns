import type { PatternDefinition } from '@/types/pattern'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import pyExample from './example.py?raw'
import goExample from './example.go?raw'
import { ChainOfResponsibilityVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'chain-of-responsibility',
  name: 'Chain of Responsibility',
  category: 'behavioral',
  order: 7,
  summary: 'Pass a request along a chain of handlers until one of them deals with it.',
  intent:
    "Pass a request along a line of handlers until one of them deals with it, so the sender doesn't need to know who will.",
  problem:
    "An API request has to pass several unrelated checks before the real code answers it: is the caller logged in, are they sending too many requests, is the payload valid? If you put all of that in one big handleRequest() method, every new check means editing the same tangled function. The caller also can't reorder the checks, skip one, or reuse a single check somewhere else.",
  solution:
    "Turn each check into its own Handler with one method, handle(request), and a reference to the next handler in the chain. A handler either deals with the request itself (for example by rejecting it) or, if it has nothing to say, passes it on by calling next.handle(request). The caller only talks to the first handler. It doesn't need to know how many links there are or in what order. This middleware-style example is the pipeline/filter variant: several links may run, and each one decides whether to reject the request or pass it on. The classic GoF form instead stops at exactly one handler that fully handles the request. Class-based tabs share forwarding through an abstract Handler base; Go uses a Handler interface and embeds BaseHandler for that behavior. Either way, this differs from Decorator in intent: a decorator always runs and always forwards, to add behavior around the call, while a chain link may stop the request outright.",
  analogy:
    "Think of a support call that keeps getting escalated. The first-line agent handles what they can and passes the rest to the next tier, and then the next, until someone with the right authority deals with it. If everyone has had a turn and nobody can help, the request is finally turned away.",
  whenToUse: [
    "More than one object might handle a request, and you don't know in advance which one should.",
    "You want to send a request without hard-wiring which object receives it.",
    "The set of handlers, and their order, should be configurable separately from the sender.",
  ],
  pros: [
    "Decouples the sender from the receivers: the client only ever knows the first handler.",
    "You can add, remove or reorder handlers without touching the sender or the other handlers.",
    "Each handler stays small and focused on one check or responsibility.",
  ],
  cons: [
    "A request can fall through the whole chain unhandled if the chain is misconfigured.",
    "To find out which handler produced a result, you have to step through the chain.",
    "Long chains add call-stack depth and latency to every request.",
  ],
  realWorld: [
    "Express/Koa/Connect middleware pipelines (app.use(...))",
    "Java Servlet Filters and the ASP.NET Core middleware pipeline",
    "DOM event bubbling: a click walks up the ancestor chain until something calls stopPropagation()",
    "Java's ClassLoader delegation model, where each loader asks its parent to resolve a class before trying to load it itself",
  ],
  related: ['decorator', 'command', 'observer', 'mediator'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 90,
      y: 100,
      description: 'Sends a request to the first handler in the chain and waits for a response. It has no idea how many handlers exist, or which one will actually answer.',
      code: 'entry',
    },
    {
      id: 'handler',
      label: 'Handler',
      role: 'Handler abstraction',
      kind: 'abstract',
      x: 400,
      y: 70,
      description: 'Defines the common handle(request) contract and forwarding behavior. Class-based tabs use an abstract base with the next reference; Go uses a Handler interface plus an embedded BaseHandler that forwards or returns the terminal "unhandled" response.',
    },
    {
      id: 'authHandler',
      label: 'AuthHandler',
      role: 'Concrete Handler',
      kind: 'class',
      x: 115,
      y: 280,
      description: 'Checks the Authorization token. A missing or expired token is rejected on the spot; a valid one is forwarded to the next handler untouched.',
    },
    {
      id: 'rateLimitHandler',
      label: 'RateLimitHandler',
      role: 'Concrete Handler',
      kind: 'class',
      x: 300,
      y: 280,
      width: 180,
      description: "Tracks each client's own fixed one-minute window and request count. Over the cap within that window, it rejects with 429; otherwise it forwards the request unchanged — one client's traffic never affects another's.",
    },
    {
      id: 'validationHandler',
      label: 'ValidationHandler',
      role: 'Concrete Handler',
      kind: 'class',
      x: 500,
      y: 280,
      width: 180,
      description: 'Checks that the request body, if present, is a non-null object rather than a primitive — a stand-in for full shape validation. A malformed payload is rejected; a well-formed one is forwarded.',
    },
    {
      id: 'controller',
      label: 'Controller',
      role: 'Concrete Handler (terminal)',
      kind: 'class',
      x: 685,
      y: 280,
      description: 'The last link in the chain. It never forwards further — it executes the actual business logic and returns the real response.',
    },
  ],
  relations: [
    {
      id: 'entry',
      from: 'client',
      to: 'authHandler',
      type: 'calls',
      label: 'handle(req)',
      description: 'The client only ever calls the first handler. Whatever eventually answers — or rejects — the request, the call looks identical from here.',
      code: 'entry',
    },
    {
      id: 'authImpl',
      from: 'authHandler',
      to: 'handler',
      type: 'implements',
      description: 'Class-based tabs inherit the next pointer and default forwarding behavior; Go AuthHandler embeds BaseHandler to reuse it while implementing Handler.',
      bend: -70,
    },
    {
      id: 'rateImpl',
      from: 'rateLimitHandler',
      to: 'handler',
      type: 'implements',
      description: 'RateLimitHandler shares the common forwarding behavior through the class-based base or Go BaseHandler embedding.',
    },
    {
      id: 'validImpl',
      from: 'validationHandler',
      to: 'handler',
      type: 'implements',
      description: 'ValidationHandler shares the common forwarding behavior through the class-based base or Go BaseHandler embedding.',
    },
    {
      id: 'controllerImpl',
      from: 'controller',
      to: 'handler',
      type: 'implements',
      description: 'The terminal Controller implements the same Handler contract (through inheritance in class-based tabs, interface implementation in Go) — it fits into the chain but never forwards.',
      bend: 70,
    },
    {
      id: 'nextAuthRate',
      from: 'authHandler',
      to: 'rateLimitHandler',
      type: 'holds',
      description: 'AuthHandler holds a reference to the next handler and forwards the request to it once its own check passes.',
      code: 'auth',
    },
    {
      id: 'nextRateValid',
      from: 'rateLimitHandler',
      to: 'validationHandler',
      type: 'holds',
      description: 'RateLimitHandler forwards to the next handler once the request is confirmed to be under the limit.',
      code: 'rateLimit',
    },
    {
      id: 'nextValidController',
      from: 'validationHandler',
      to: 'controller',
      type: 'holds',
      description: 'ValidationHandler forwards to the final handler once the payload checks out.',
      code: 'validation',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'A request arrives',
      description: 'The client sends GET /orders/42 with a bearer token to the first handler in the chain. It has no idea what comes after AuthHandler.',
      highlight: ['client', 'entry', 'authHandler'],
      packets: [{ relation: 'entry', label: 'GET /orders/42' }],
      notes: { authHandler: 'inspecting…' },
      code: 'entry',
    },
    {
      title: 'AuthHandler inspects it',
      description: 'It checks the Authorization header. The token is valid, so this handler has nothing more to say about the request.',
      highlight: ['authHandler'],
      notes: { authHandler: 'token ok ✓' },
      code: 'auth',
    },
    {
      title: 'Forwarded to RateLimitHandler',
      description: 'AuthHandler calls next.handle(request) — it does not resolve the request itself, it just passes it on to whoever is next.',
      highlight: ['nextAuthRate', 'rateLimitHandler'],
      packets: [{ relation: 'nextAuthRate', label: 'next.handle()' }],
      notes: { rateLimitHandler: 'inspecting…' },
      code: 'rateLimit',
    },
    {
      title: 'Still under the limit',
      description: "RateLimitHandler counts this client at 1 request in its current one-minute window — well under the cap of 100 — so it also forwards the request onward. A different client's count is tracked separately and would not be affected.",
      highlight: ['rateLimitHandler'],
      notes: { rateLimitHandler: '1/100 ✓' },
      code: 'rateLimit',
    },
    {
      title: 'Forwarded to ValidationHandler',
      description: 'The same next.handle() call pattern repeats — RateLimitHandler never learns whether ValidationHandler accepts or rejects what it sends.',
      highlight: ['nextRateValid', 'validationHandler'],
      packets: [{ relation: 'nextRateValid', label: 'next.handle()' }],
      notes: { validationHandler: 'inspecting…' },
      code: 'validation',
    },
    {
      title: 'The payload checks out',
      description: 'A GET request carries no body to validate, so ValidationHandler has nothing to reject and forwards it to the last link.',
      highlight: ['validationHandler'],
      notes: { validationHandler: 'schema ok ✓' },
      code: 'validation',
    },
    {
      title: 'Forwarded to the Controller',
      description: 'ValidationHandler calls next.handle() one final time. The Controller is the only link that actually understands /orders.',
      highlight: ['nextValidController', 'controller'],
      packets: [{ relation: 'nextValidController', label: 'next.handle()' }],
      notes: { controller: 'inspecting…' },
      code: 'controller',
    },
    {
      title: 'The chain settles',
      description: 'Controller executes the real business logic and returns 200 OK directly — it never calls next, because there is nothing left to forward to.',
      highlight: ['controller'],
      notes: { controller: '200 OK' },
      code: 'controller',
    },
    {
      title: 'A different request gets rejected early',
      description: 'A second request carries an expired token. AuthHandler rejects it immediately and returns 401 straight to the client — RateLimitHandler, ValidationHandler and Controller never even see it.',
      highlight: ['entry', 'authHandler'],
      packets: [{ relation: 'entry', label: '401 Unauthorized', reverse: true }],
      notes: { authHandler: 'token expired ✗' },
      code: 'auth',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: ChainOfResponsibilityVisualization,
}
