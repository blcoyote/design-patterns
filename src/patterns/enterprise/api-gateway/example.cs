// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [usage]
var users = new UserService();
var orders = new OrderService();
var limiter = new FixedWindowRateLimiter(3);
var gateway = new ApiGateway(new Authenticator(), limiter, Routes.CreateRoutes(users, orders));

static void Send(ApiGateway gateway, string token, string method, string path)
{
    var response = gateway.Handle(new GatewayRequest(token, method, path));
    Console.WriteLine(FormattableString.Invariant($"{method} {path} [{token}] -> {response.Status} {response.Body}"));
}

Send(gateway, "token-alice", "GET", "/profile"); // 200 Alice <alice@example.com>
Send(gateway, "token-alice", "GET", "/orders"); // 200 order-1 (2 items), order-2 (3 items)
Send(gateway, "token-alice", "GET", "/home"); // 200 Alice: 2 orders (two service calls)
Send(gateway, "token-mallory", "GET", "/orders"); // 401: no limiter check, no service call
Send(gateway, "token-alice", "GET", "/profile"); // 429: alice has used 3 of 3, not counted
Console.WriteLine("[gateway] next window");
gateway.NextWindow();
Send(gateway, "token-alice", "GET", "/admin"); // 404, but it still counts: alice 1/3
Send(gateway, "token-bob", "GET", "/orders"); // 200 no orders: bob is counted separately from alice

Console.WriteLine(FormattableString.Invariant($"backend calls: users {users.Calls}, orders {orders.Calls}")); // users 2, orders 3
Console.WriteLine(FormattableString.Invariant(
    $"rate limit: alice {limiter.Used("alice")}/{limiter.Limit}, bob {limiter.Used("bob")}/{limiter.Limit}")); // alice 1/3, bob 1/3
// [/usage]

// [http]
// What a client sends to the gateway: plain data, no network involved.
record GatewayRequest(string Token, string Method, string Path);

record GatewayResponse(int Status, string Body);

// A route handler gets the authenticated user id and builds the response.
delegate GatewayResponse RouteHandler(string userId);
// [/http]

// [services]
record Profile(string Name, string Email);

record OrderSummary(string Id, int Items);

// The services trust the user id the gateway hands them. Real systems pass a
// signed token (e.g. a JWT) or secure the gateway-to-service hop (e.g. mTLS), so
// a caller that bypasses the gateway cannot claim to be someone else.
class UserService
{
    public int Calls { get; private set; } // counted first thing in Profile(), so the usage can show who was reached

    private readonly Dictionary<string, Profile> _profiles = new()
    {
        ["alice"] = new Profile("Alice", "alice@example.com"),
        ["bob"] = new Profile("Bob", "bob@example.com"),
    };

    public Profile Profile(string userId)
    {
        Calls++;
        if (!_profiles.TryGetValue(userId, out var found))
        {
            throw new InvalidOperationException($"unknown user {userId}"); // the gateway only passes ids it authenticated
        }
        return found;
    }
}

class OrderService
{
    public int Calls { get; private set; } // counted first thing in Recent()

    private readonly Dictionary<string, List<OrderSummary>> _orders = new()
    {
        ["alice"] = [new OrderSummary("order-1", 2), new OrderSummary("order-2", 3)],
    };

    public IReadOnlyList<OrderSummary> Recent(string userId)
    {
        Calls++;
        return _orders.TryGetValue(userId, out var found) ? found : []; // bob has no entry: no orders
    }
}
// [/services]

// [authenticator]
class Authenticator
{
    private readonly Dictionary<string, string> _users = new()
    {
        ["token-alice"] = "alice",
        ["token-bob"] = "bob",
    };

    // The user id for a known token, or null for an unknown one.
    public string? Authenticate(string token) => _users.TryGetValue(token, out var userId) ? userId : null;
}
// [/authenticator]

// [rateLimiter]
// A fixed-window counter per user. The window is advanced by an explicit
// NextWindow() call instead of a clock, so the example stays deterministic. Real
// limiters often use sliding windows or token buckets, and keep their counters in
// shared storage (e.g. Redis) when the gateway runs as several instances.
class FixedWindowRateLimiter(int limit)
{
    private readonly Dictionary<string, int> _counts = new();

    public int Limit { get; } = limit;

    // Counts the request and returns true while the user is under the limit.
    public bool TryAcquire(string userId)
    {
        var used = Used(userId);
        if (used >= Limit)
        {
            return false; // rejected requests are not counted
        }
        _counts[userId] = used + 1;
        return true;
    }

    public int Used(string userId) => _counts.TryGetValue(userId, out var used) ? used : 0;

    // Starts a new window: every user's count goes back to zero.
    public void NextWindow() => _counts.Clear();
}
// [/rateLimiter]

// [aggregation]
// Aggregation: one client call becomes two service calls, composed into a single
// response. This handler is a Facade over the two services.
static class Aggregation
{
    public static RouteHandler HomeRoute(UserService users, OrderService orders) => userId =>
    {
        var profile = users.Profile(userId);
        var recent = orders.Recent(userId);
        return new GatewayResponse(200, FormattableString.Invariant($"{profile.Name}: {recent.Count} orders"));
    };
}
// [/aggregation]

// [routes]
// The route table: the exact string "<METHOD> <path>" maps to a handler.
static class Routes
{
    public static Dictionary<string, RouteHandler> CreateRoutes(UserService users, OrderService orders) => new()
    {
        ["GET /profile"] = userId =>
        {
            var profile = users.Profile(userId);
            return new GatewayResponse(200, $"{profile.Name} <{profile.Email}>");
        },
        ["GET /orders"] = userId =>
        {
            var recent = orders.Recent(userId);
            var body = recent.Count == 0
                ? "no orders"
                : string.Join(", ", recent.Select(order => FormattableString.Invariant($"{order.Id} ({order.Items} items)")));
            return new GatewayResponse(200, body);
        },
        ["GET /home"] = Aggregation.HomeRoute(users, orders),
    };
}
// [/routes]

// [gateway]
// A real gateway (Kong, Amazon API Gateway, YARP, ...) is a separate network
// process configured with routes and plugins. Here it is an in-process class and
// the requests are plain objects, so the example runs the same in every language.
// The checks below are a fixed sequence; real gateways usually build them as a
// configurable filter chain, which is the Middleware pattern.
class ApiGateway(Authenticator authenticator, FixedWindowRateLimiter limiter, Dictionary<string, RouteHandler> routes)
{
    public GatewayResponse Handle(GatewayRequest request)
    {
        var userId = authenticator.Authenticate(request.Token);
        if (userId is null)
        {
            return new GatewayResponse(401, "unknown token"); // nothing else runs
        }
        if (!limiter.TryAcquire(userId))
        {
            return new GatewayResponse(
                429,
                FormattableString.Invariant($"rate limit: {limiter.Limit} requests per window"));
        }
        // Limiting happens before routing, so a request with no route still counts.
        if (!routes.TryGetValue($"{request.Method} {request.Path}", out var route))
        {
            return new GatewayResponse(404, $"no route for {request.Method} {request.Path}");
        }
        return route(userId);
    }

    public void NextWindow() => limiter.NextWindow();
}
// [/gateway]
