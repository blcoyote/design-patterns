// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
void Send(Handler app, string? token)
{
    var res = app(new Request("/report", token));
    Console.WriteLine($"=> {res.Status}");
}

var app = Pipeline.Build(new Middleware[] { Middlewares.Logging, Middlewares.Auth, Middlewares.MakeCache() }, Middlewares.BuildReport);

Send(app, "t-1"); // first request: every middleware runs, the handler builds the report
// log: -> /report
// auth: token accepted
// cache: miss /report
// handler: building /report
// cache: stored /report
// log: <- 200
// => 200

Send(app, "t-1"); // second request: the cache answers, so the handler never runs
// log: -> /report
// auth: token accepted
// cache: hit /report
// log: <- 200
// => 200

Send(app, null); // no token: auth rejects, so the cache and handler never run
// log: -> /report
// auth: no token, rejected
// log: <- 401
// => 401

// [reorder]
// The same pieces in a different order: the cache now runs before auth.
var unsafeApp = Pipeline.Build(new Middleware[] { Middlewares.Logging, Middlewares.MakeCache(), Middlewares.Auth }, Middlewares.BuildReport);
// [/reorder]

Send(unsafeApp, "t-1"); // a signed-in request warms the cache
// log: -> /report
// cache: miss /report
// auth: token accepted
// handler: building /report
// cache: stored /report
// log: <- 200
// => 200

Send(unsafeApp, null); // an anonymous request is answered from the cache: auth never ran
// log: -> /report
// cache: hit /report
// log: <- 200
// => 200
// [/client]

record Request(string Path, string? Token);

record Response(int Status);

delegate Response Handler(Request req);

// A middleware receives the request and the rest of the pipeline as next.
delegate Response Middleware(Request req, Handler next);

// [pipeline]
static class Pipeline
{
    // Wraps the handler in the middlewares from last to first, so the first one in
    // the list is the outermost: it sees the request first and the response last.
    public static Handler Build(IEnumerable<Middleware> middlewares, Handler handler)
    {
        var result = handler;
        foreach (var middleware in middlewares.Reverse())
        {
            var next = result;
            result = req => middleware(req, next);
        }
        return result;
    }
}
// [/pipeline]

static class Middlewares
{
    // [logging]
    public static Response Logging(Request req, Handler next)
    {
        Console.WriteLine($"log: -> {req.Path}");
        var res = next(req);
        // [logAfter]
        // Code after next() runs on the way back out, once the response exists.
        Console.WriteLine($"log: <- {res.Status}");
        // [/logAfter]
        return res;
    }
    // [/logging]

    // [auth]
    public static Response Auth(Request req, Handler next)
    {
        // [authReject]
        // Short-circuit: answer here and never call next(), so nothing deeper runs.
        if (req.Token is null)
        {
            Console.WriteLine("auth: no token, rejected");
            return new Response(401);
        }
        // [/authReject]
        Console.WriteLine("auth: token accepted");
        return next(req);
    }
    // [/auth]

    // [cache]
    // Keyed by path only, so it must sit behind auth: it does not know who is asking.
    public static Middleware MakeCache()
    {
        var stored = new Dictionary<string, Response>();
        return (req, next) =>
        {
            // [cacheHit]
            if (stored.TryGetValue(req.Path, out var hit))
            {
                Console.WriteLine($"cache: hit {req.Path}");
                return hit;
            }
            // [/cacheHit]
            Console.WriteLine($"cache: miss {req.Path}");
            var res = next(req);
            if (res.Status == 200)
            {
                stored[req.Path] = res;
                Console.WriteLine($"cache: stored {req.Path}");
            }
            return res;
        };
    }
    // [/cache]

    // [handler]
    public static Response BuildReport(Request req)
    {
        Console.WriteLine($"handler: building {req.Path}");
        return new Response(200);
    }
    // [/handler]
}
