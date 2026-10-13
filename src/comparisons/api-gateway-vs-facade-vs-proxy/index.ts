/**
 * All three stand in front of something, which is why they get confused. Every claim below was
 * checked against `src/patterns/enterprise/api-gateway`, `src/patterns/structural/facade` and
 * `src/patterns/structural/proxy` (index.ts and all four language examples) rather than against
 * the patterns in the abstract. Facade is also covered, against Adapter and Decorator, by the
 * `adapter-vs-facade-vs-decorator` comparison; this one stays on what differs here.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "api-gateway-vs-facade-vs-proxy",
  title: "API Gateway vs Facade vs Proxy",
  order: 13,
  summary:
    "All three stand in front of something: a simpler interface, a same-interface stand-in, or a network entry point with checks?",
  subjects: [
    { kind: "pattern", slug: "api-gateway" },
    { kind: "pattern", slug: "facade" },
    { kind: "pattern", slug: "proxy" },
  ],
  problem:
    "Clients are reaching straight into something with several parts, or something that is costly to reach, and you want an object in front of it. The object in front can offer a simpler interface (Facade), keep the interface and control access to one subject (Proxy), or be one entry point to a set of services that also runs cross-cutting checks (API Gateway).",
  constraints: [
    "Should clients see a new, simpler interface, or the same interface as the thing behind it?",
    "How many things sit behind the front object: one subject, one subsystem of cooperating objects, or several separate services?",
    "Does the front object live in the same process as its clients, or is it a network hop that every client request passes through?",
    "Do checks such as authentication or rate limiting have to run in one place instead of being rebuilt in every service?",
    "Is anything in front needed at all, or can the client call what it needs directly?",
  ],
  dimensions: [
    {
      label: "Intent",
      values: {
        "api-gateway":
          "Give clients one entry point to a set of services, and run the checks that should not be rebuilt in every service.",
        facade:
          "Offer one simple interface in front of a complicated subsystem, so clients do not coordinate its parts.",
        proxy:
          "Stand in for one object with the same interface, to control access to it: delay creating it, cache its answers, check permissions.",
      },
    },
    {
      label: "Interface the client sees",
      values: {
        "api-gateway":
          "A request-shaped one: a token, a method and a path go in, and a status and body come out. It is not the interface of UserService or OrderService.",
        facade:
          "A new, simpler one: HomeTheaterFacade has one watch-movie method in place of calls to four subsystem objects.",
        proxy:
          "The same one as the real subject: CachingVideoProxy and RealVideoService both implement the video-service interface, so the client holds only that interface.",
      },
    },
    {
      label: "How many things it fronts",
      values: {
        "api-gateway":
          "Several services behind different routes. In this example, UserService and OrderService behind three routes.",
        facade:
          "One subsystem made of several cooperating objects. In this example, Amplifier, DvdPlayer, Projector and Screen.",
        proxy: "One real subject. In this example, a single RealVideoService.",
      },
    },
    {
      label: "Process boundary",
      values: {
        "api-gateway":
          "A real gateway is a separate network process that client traffic passes through. This example's gateway is an in-process object and a request is plain data, so it shows the logic but not the network hop.",
        facade:
          "Normally an object in the same process as its client and the subsystem, as in this example.",
        proxy:
          "Can be in process, like this caching proxy and its in-process real service, or a local stand-in for something remote, as with a client stub (a remote proxy).",
      },
    },
    {
      label: "Cross-cutting checks",
      values: {
        "api-gateway":
          "Yes, that is part of the point. Here it authenticates the token (401), applies a limit of 3 requests per window (429) and looks up the route (404), in that order, before any service is called.",
        facade:
          "None in this example: the facade only sequences calls to the subsystem objects. Its job is simplification, not checking.",
        proxy:
          "Whatever access control the proxy adds. This example's proxy adds lazy creation and caching; the page also lists permission checks as a use. It adds them for one subject.",
      },
    },
    {
      label: "Aggregation",
      values: {
        "api-gateway":
          "Optional. Its GET /home handler turns one client request into a profile call and then an orders call, and composes one body. That handler is itself a Facade over two services.",
        facade:
          "Central to it: one client call becomes calls to several subsystem objects in the right order.",
        proxy:
          "Not what it does: each client call is forwarded to the one subject, or answered from the cache.",
      },
    },
    {
      label: "Main risk",
      values: {
        "api-gateway":
          "One more hop and a single point of failure unless it is deployed redundantly, and business logic can pile up in it if aggregation grows.",
        facade: "It can grow into a god object coupled to every class in the subsystem.",
        proxy:
          "More indirection, and a caching proxy can return stale data if invalidation is not handled carefully.",
      },
    },
  ],
  options: [
    {
      subject: "api-gateway",
      changes:
        "Clients talk only to ApiGateway. Each request is authenticated, rate-limited and routed by the exact string of method and path to a handler, and a failing check is answered by the gateway itself, so no service is called for it. GET /home composes two service calls into one response.",
      chooseWhen: [
        "Several services sit behind one entry point, and clients should know one address and one set of routes.",
        "Authentication, rate limiting or routing should run in one place in front of the services instead of being rebuilt in each.",
        "A screen needs data from more than one service, and the gateway can compose it with light aggregation and no business rules.",
      ],
      code: [
        { kind: "pattern", slug: "api-gateway", region: "gateway" },
        { kind: "pattern", slug: "api-gateway", region: "aggregation" },
      ],
      steps: [
        { kind: "pattern", slug: "api-gateway", step: 3 },
        { kind: "pattern", slug: "api-gateway", step: 4 },
        { kind: "pattern", slug: "api-gateway", step: 5 },
      ],
    },
    {
      subject: "facade",
      changes:
        "HomeTheaterFacade offers one watch-movie method and calls the screen, projector, amplifier and DVD player in the right order. The client no longer coordinates four objects. It is a new interface rather than one the subsystem already had, and the example has no checks or network.",
      chooseWhen: [
        "A subsystem of cooperating objects is awkward to use and clients keep repeating the same sequence of calls.",
        "You want client code to stay independent of the subsystem's internals, in process.",
        "No authentication, rate limiting or network hop is involved, only a simpler way in.",
      ],
      code: [
        { kind: "pattern", slug: "facade", region: "facade" },
        { kind: "pattern", slug: "facade", region: "watchMovie" },
      ],
      steps: [
        { kind: "pattern", slug: "facade", step: 0 },
        { kind: "pattern", slug: "facade", step: 5 },
      ],
    },
    {
      subject: "proxy",
      changes:
        "CachingVideoProxy implements the same video-service interface as RealVideoService. It creates the real service on the first cache miss, forwards the call and caches the result, so the second request for the same video is answered without touching the real service. The client code does not change.",
      chooseWhen: [
        "There is one subject and clients should keep using its existing interface unchanged.",
        "Creating or reaching the subject is costly, so you want to delay it, cache its answers or stand in for something remote.",
        "Access to that one subject needs controlling, such as permission checks, without changing the subject itself.",
      ],
      code: [
        { kind: "pattern", slug: "proxy", region: "videoService" },
        { kind: "pattern", slug: "proxy", region: "getVideo" },
        { kind: "pattern", slug: "proxy", region: "lazyCreate" },
      ],
      steps: [
        { kind: "pattern", slug: "proxy", step: 0 },
        { kind: "pattern", slug: "proxy", step: 4 },
      ],
    },
  ],
  noPattern: {
    when: "A client needs one service or one object, that object's interface is already fine, and nothing has to be checked or cached in front of it.",
    instead:
      "Call it directly. Add a Facade when clients start repeating the same sequence of calls, a Proxy when one subject needs lazy creation, caching or access control, and a gateway when several services need a shared entry point and shared checks.",
  },
  overlap:
    "These are complementary and often used together. A gateway fronts many services, and its aggregating handler is a Facade over two of them. A client of one of those services may hold a remote proxy for it, which is a Proxy with the same interface as the service. They differ in interface shape (new, same, or request-shaped), in how many things they front, and in whether they sit on the network edge and run shared checks. The Adapter vs Facade vs Decorator comparison covers how Facade differs from its other look-alikes.",
  scenario: {
    prompt:
      "A mobile app needs a user's profile from UserService and their recent orders from OrderService. Every request must be authenticated and rate-limited, and the two services should be free to move without breaking the app. Which fits best?",
    choices: [
      {
        id: "api-gateway",
        option: "api-gateway",
        label: "An API Gateway in front of both services",
        verdict: "best",
        explanation:
          "One entry point authenticates and rate-limits each request, routes it to the owning service, and can compose the profile and orders calls into one response, as the example's GET /home handler does. Services can move behind it by changing the route table. A real gateway is a separate network process; the example only models its logic in process.",
      },
      {
        id: "facade",
        option: "facade",
        label: "A Facade object that calls both services",
        verdict: "poor",
        explanation:
          "A Facade is a simpler interface, usually in process, so it can combine the two calls. It does not by itself give you one place that authenticates and rate-limits every client, or one address that hides where the services live. Those checks would be rebuilt in each client or service.",
      },
      {
        id: "proxy",
        option: "proxy",
        label: "A Proxy for each service, with the same interface",
        verdict: "poor",
        explanation:
          "A proxy stands in for one subject and keeps its interface, so one per service would leave the app calling two interfaces and doing its own composition. Each proxy would also have to repeat the authentication and rate-limiting checks. That is not one entry point.",
      },
      {
        id: "none",
        option: "none",
        label: "No pattern: the app calls each service directly",
        verdict: "workable",
        explanation:
          "For one client and two services this can be enough, with each service checking tokens and limiting requests itself. The cost is that every service rebuilds those checks, the app learns where each service lives, and a screen needing both costs two round trips.",
      },
    ],
  },
};
