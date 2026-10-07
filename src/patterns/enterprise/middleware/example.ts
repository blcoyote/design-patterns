interface Request {
  readonly path: string;
  readonly token: string | null;
}

interface Response {
  readonly status: number;
}

type Handler = (req: Request) => Response;
// A middleware receives the request and the rest of the pipeline as next.
type Middleware = (req: Request, next: Handler) => Response;

// [pipeline]
// Wraps the handler in the middlewares from last to first, so the first one in
// the list is the outermost: it sees the request first and the response last.
function pipeline(middlewares: Middleware[], handler: Handler): Handler {
  return middlewares.reduceRight<Handler>(
    (next, middleware) => (req) => middleware(req, next),
    handler,
  );
}
// [/pipeline]

// [logging]
const logging: Middleware = (req, next) => {
  console.log(`log: -> ${req.path}`);
  const res = next(req);
  // [logAfter]
  // Code after next() runs on the way back out, once the response exists.
  console.log(`log: <- ${res.status}`);
  // [/logAfter]
  return res;
};
// [/logging]

// [auth]
const auth: Middleware = (req, next) => {
  // [authReject]
  // Short-circuit: answer here and never call next(), so nothing deeper runs.
  if (req.token === null) {
    console.log("auth: no token, rejected");
    return { status: 401 };
  }
  // [/authReject]
  console.log("auth: token accepted");
  return next(req);
};
// [/auth]

// [cache]
// Keyed by path only, so it must sit behind auth: it does not know who is asking.
function makeCache(): Middleware {
  const stored = new Map<string, Response>();
  return (req, next) => {
    // [cacheHit]
    const hit = stored.get(req.path);
    if (hit) {
      console.log(`cache: hit ${req.path}`);
      return hit;
    }
    // [/cacheHit]
    console.log(`cache: miss ${req.path}`);
    const res = next(req);
    if (res.status === 200) {
      stored.set(req.path, res);
      console.log(`cache: stored ${req.path}`);
    }
    return res;
  };
}
// [/cache]

// [handler]
const handler: Handler = (req) => {
  console.log(`handler: building ${req.path}`);
  return { status: 200 };
};
// [/handler]

// [client]
function send(app: Handler, token: string | null): void {
  const res = app({ path: "/report", token });
  console.log(`=> ${res.status}`);
}

const app = pipeline([logging, auth, makeCache()], handler);

send(app, "t-1"); // first request: every middleware runs, the handler builds the report
// log: -> /report
// auth: token accepted
// cache: miss /report
// handler: building /report
// cache: stored /report
// log: <- 200
// => 200

send(app, "t-1"); // second request: the cache answers, so the handler never runs
// log: -> /report
// auth: token accepted
// cache: hit /report
// log: <- 200
// => 200

send(app, null); // no token: auth rejects, so the cache and handler never run
// log: -> /report
// auth: no token, rejected
// log: <- 401
// => 401

// [reorder]
// The same pieces in a different order: the cache now runs before auth.
const unsafe = pipeline([logging, makeCache(), auth], handler);
// [/reorder]

send(unsafe, "t-1"); // a signed-in request warms the cache
// log: -> /report
// cache: miss /report
// auth: token accepted
// handler: building /report
// cache: stored /report
// log: <- 200
// => 200

send(unsafe, null); // an anonymous request is answered from the cache: auth never ran
// log: -> /report
// cache: hit /report
// log: <- 200
// => 200
// [/client]
