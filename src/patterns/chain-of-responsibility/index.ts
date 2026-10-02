import type { PatternDefinition } from '@/types/pattern'
import { ChainOfResponsibilityVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'chain-of-responsibility',
  name: 'Chain of Responsibility',
  category: 'behavioral',
  order: 7,
  summary: 'Pass a request along a chain of handlers until one of them deals with it.',
  intent:
    'Avoid coupling the sender of a request to its receiver by giving more than one object a chance to handle it — chain the receiving objects and pass the request along the chain until something handles it.',
  problem:
    'An incoming API request has to survive several unrelated checks — authentication, rate limiting, payload validation — before it reaches the code that actually answers it. Wiring all of that into one big handleRequest() method means every new check edits the same tangled function, and the caller has no way to reorder, skip, or reuse just one of the checks elsewhere.',
  solution:
    'Each check becomes its own Handler with one method, handle(request), and a reference to the next handler in the chain. A handler either resolves the request itself — rejecting it, say — or, when it has nothing to say about it, forwards it on by calling next.handle(request). The caller only ever talks to the first handler and never needs to know how many links the chain actually has, or in what order. This middleware-style example is the pipeline/filter variant, where several links may run and each one decides whether to reject or pass the request on; the classic GoF form instead stops at exactly one handler that fully handles the request. Either way, Chain of Responsibility differs from Decorator in intent: a decorator always runs and always forwards to wrap behavior around the call, while a chain link may stop the request outright.',
  analogy:
    'A support call that keeps getting escalated: the first-line agent handles what they can, and anything they cannot resolve gets passed to the next tier, then the next, until someone with the right authority deals with it — or everyone in the chain has had a turn and it is finally turned away.',
  whenToUse: [
    'More than one object may handle a request, and the right one is not known in advance.',
    'You want to issue a request without hard-wiring it to a specific receiver.',
    'The set of handlers, and their order, should be configurable independently of the sender.',
  ],
  pros: [
    'Decouples the sender from its receivers — the client only ever knows the first handler.',
    'Handlers can be added, removed, or reordered without touching the sender or each other.',
    'Each handler stays small and focused on exactly one check or responsibility.',
  ],
  cons: [
    'A request can fall through the entire chain unhandled if it is mis-configured.',
    'Tracing which handler actually produced a result means stepping through the whole chain.',
    'Long chains add call-stack depth and latency to every single request.',
  ],
  realWorld: [
    'Express/Koa/Connect middleware pipelines (app.use(...))',
    'Java Servlet Filters and the ASP.NET Core middleware pipeline',
    'DOM event bubbling — a click walks up the ancestor chain until something calls stopPropagation()',
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
      role: 'Abstract Handler',
      kind: 'abstract',
      x: 400,
      y: 70,
      description: 'Declares handle(request) and holds a reference to the next handler. Its default handle() just forwards to next when present, or returns a terminal "unhandled" response.',
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
      description: 'AuthHandler extends the abstract Handler, inheriting its next-pointer and default forwarding behavior.',
      bend: -70,
    },
    {
      id: 'rateImpl',
      from: 'rateLimitHandler',
      to: 'handler',
      type: 'implements',
      description: 'RateLimitHandler extends the abstract Handler the same way every other link does.',
    },
    {
      id: 'validImpl',
      from: 'validationHandler',
      to: 'handler',
      type: 'implements',
      description: 'ValidationHandler extends the abstract Handler the same way every other link does.',
    },
    {
      id: 'controllerImpl',
      from: 'controller',
      to: 'handler',
      type: 'implements',
      description: 'Even the terminal Controller extends Handler, so it fits into the chain just like any other link — it simply never calls next.',
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
      description: "RateLimitHandler counts this client at 7 requests in its current one-minute window — well under the cap of 100 — so it also forwards the request onward. A different client's count is tracked separately and would not be affected.",
      highlight: ['rateLimitHandler'],
      notes: { rateLimitHandler: '7/100 ✓' },
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
  code: `
interface HttpRequest {
  path: string
  clientId: string
  token?: string
  body?: unknown
}

interface HttpResponse {
  status: number
  body: string
}

// [handler]
abstract class Handler {
  private next: Handler | null = null

  setNext(handler: Handler): Handler {
    this.next = handler
    return handler
  }

  handle(req: HttpRequest): HttpResponse {
    if (this.next) return this.next.handle(req)
    return { status: 404, body: 'No handler matched' }
  }
}
// [/handler]

// [authHandler]
class AuthHandler extends Handler {
  // [auth]
  handle(req: HttpRequest): HttpResponse {
    if (!req.token || req.token === 'expired') {
      return { status: 401, body: 'Unauthorized' }
    }
    return super.handle(req) // not my problem — pass it on
  }
  // [/auth]
}
// [/authHandler]

// [rateLimitHandler]
class RateLimitHandler extends Handler {
  private static readonly WINDOW_MS = 60_000
  private static readonly LIMIT = 100

  // Each client gets its own fixed window — one client going over the cap
  // never affects any other client's count.
  private readonly windows = new Map<string, { windowStart: number; count: number }>()

  // [rateLimit]
  handle(req: HttpRequest): HttpResponse {
    const now = Date.now()
    let window = this.windows.get(req.clientId)
    if (!window || now - window.windowStart >= RateLimitHandler.WINDOW_MS) {
      window = { windowStart: now, count: 0 }
      this.windows.set(req.clientId, window)
    }
    window.count++
    if (window.count > RateLimitHandler.LIMIT) {
      return { status: 429, body: 'Too Many Requests' }
    }
    return super.handle(req)
  }
  // [/rateLimit]
}
// [/rateLimitHandler]

// [validationHandler]
class ValidationHandler extends Handler {
  // [validation]
  handle(req: HttpRequest): HttpResponse {
    if (req.body !== undefined && (req.body === null || typeof req.body !== 'object')) {
      return { status: 422, body: 'Invalid payload' }
    }
    return super.handle(req) // no body to check, or it already looks fine
  }
  // [/validation]
}
// [/validationHandler]

// [controller]
class Controller extends Handler {
  handle(req: HttpRequest): HttpResponse {
    // The terminal link: it never calls next, it just answers.
    return { status: 200, body: \`handled \${req.path}\` }
  }
}
// [/controller]

// [entry]
const chain = new AuthHandler()
chain.setNext(new RateLimitHandler()).setNext(new ValidationHandler()).setNext(new Controller())

chain.handle({ path: '/orders/42', clientId: 'client-1', token: 'abc123' }) // { status: 200, body: 'handled /orders/42' }
chain.handle({ path: '/orders/42', clientId: 'client-1', token: 'expired' }) // { status: 401, ... } — stops at AuthHandler
// [/entry]
`,
  csharp: `
// [entry]
var chain = new AuthHandler();
chain.SetNext(new RateLimitHandler()).SetNext(new ValidationHandler()).SetNext(new Controller());

chain.Handle(new HttpRequest("/orders/42", "client-1", "abc123")); // { Status: 200, Body: "handled /orders/42" }
chain.Handle(new HttpRequest("/orders/42", "client-1", "expired")); // { Status: 401, ... } — stops at AuthHandler
// [/entry]

record HttpRequest(string Path, string ClientId, string? Token = null, object? Body = null);

record HttpResponse(int Status, string Body);

// [handler]
abstract class Handler
{
    private Handler? _next;

    public Handler SetNext(Handler handler)
    {
        _next = handler;
        return handler;
    }

    public virtual HttpResponse Handle(HttpRequest req)
    {
        if (_next is not null) return _next.Handle(req);
        return new HttpResponse(404, "No handler matched");
    }
}
// [/handler]

// [authHandler]
class AuthHandler : Handler
{
    // [auth]
    public override HttpResponse Handle(HttpRequest req)
    {
        if (req.Token is null or "expired")
        {
            return new HttpResponse(401, "Unauthorized");
        }
        return base.Handle(req); // not my problem — pass it on
    }
    // [/auth]
}
// [/authHandler]

// [rateLimitHandler]
class RateLimitHandler : Handler
{
    private static readonly TimeSpan Window = TimeSpan.FromMilliseconds(60_000);
    private const int Limit = 100;

    // Each client gets its own fixed window — one client going over the cap
    // never affects any other client's count.
    private readonly Dictionary<string, (DateTime WindowStart, int Count)> _windows = new();

    // [rateLimit]
    public override HttpResponse Handle(HttpRequest req)
    {
        var now = DateTime.UtcNow;
        if (!_windows.TryGetValue(req.ClientId, out var window) || now - window.WindowStart >= Window)
        {
            window = (now, 0);
        }
        window.Count++;
        _windows[req.ClientId] = window;
        if (window.Count > Limit)
        {
            return new HttpResponse(429, "Too Many Requests");
        }
        return base.Handle(req);
    }
    // [/rateLimit]
}
// [/rateLimitHandler]

// [validationHandler]
class ValidationHandler : Handler
{
    // [validation]
    public override HttpResponse Handle(HttpRequest req)
    {
        if (req.Body is not null && req.Body is not IDictionary<string, object>)
        {
            return new HttpResponse(422, "Invalid payload");
        }
        return base.Handle(req); // no body to check, or it already looks fine
    }
    // [/validation]
}
// [/validationHandler]

// [controller]
class Controller : Handler
{
    public override HttpResponse Handle(HttpRequest req)
    {
        // The terminal link: it never calls next, it just answers.
        return new HttpResponse(200, $"handled {req.Path}");
    }
}
// [/controller]
`,
  Visualization: ChainOfResponsibilityVisualization,
}
