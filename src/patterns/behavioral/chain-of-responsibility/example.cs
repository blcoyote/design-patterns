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
        if (req.Body is not null && (req.Body is string or decimal || req.Body.GetType().IsPrimitive))
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
