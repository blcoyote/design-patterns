// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [usage]
var inventory = new InventoryService();
var network = new Network();
network.Register("inventory", inventory);

var sidecar = new Sidecar("orders", network, 1);
var orders = new OrderService(sidecar);

orders.CheckStock("sku-1");

inventory.FailNextCall();
orders.CheckStock("sku-1"); // the sidecar retries; the app sees only the 200

Console.WriteLine("[usage] same app code wired straight to the network, bypassing the sidecar");
var direct = new OrderService(network);
direct.CheckStock("sku-1");

sidecar.SetMaxRetries(0);
inventory.FailNextCall();
orders.CheckStock("sku-1");

Console.WriteLine(FormattableString.Invariant(
    $"sidecar metrics: requests {sidecar.Requests}, attempts {sidecar.Attempts}, retries {sidecar.Retries}, failures {sidecar.Failures}"));
Console.WriteLine(FormattableString.Invariant($"inventory calls: {inventory.Calls}"));
// [/usage]

// [http]
record HttpRequest(string Method, string To, string Path, IReadOnlyDictionary<string, string> Headers);

record HttpResponse(int Status, string Body);

/// <summary>Anything that can carry a request to another service.</summary>
interface IOutbound
{
    HttpResponse Send(HttpRequest request);
}

/// <summary>A service that can answer a request.</summary>
interface IService
{
    HttpResponse Handle(HttpRequest request);
}

static class Http
{
    // Returns a NEW request with a copied header dictionary; the original is unchanged.
    public static HttpRequest WithHeader(HttpRequest request, string name, string value)
    {
        var headers = new Dictionary<string, string>(request.Headers) { [name] = value };
        return request with { Headers = headers };
    }
}
// [/http]

// [inventory]
class InventoryService : IService
{
    private bool _failNext;

    public int Calls { get; private set; }

    // Scripted failure: exactly the next call answers 503.
    public void FailNextCall()
    {
        _failNext = true;
        Console.WriteLine("[inventory] next call will fail with 503");
    }

    public HttpResponse Handle(HttpRequest request)
    {
        Calls++;
        if (!request.Headers.ContainsKey("x-client-identity"))
        {
            return new HttpResponse(401, "no client identity");
        }
        if (_failNext)
        {
            _failNext = false;
            return new HttpResponse(503, "busy");
        }
        var sku = request.Path["/stock/".Length..];
        return new HttpResponse(200, $"{sku}: 3 in stock");
    }
}
// [/inventory]

// [network]
// Stands in for the cluster network: a lookup by service name, then a method call.
class Network : IOutbound
{
    private readonly Dictionary<string, IService> _services = [];

    public void Register(string name, IService service)
    {
        _services[name] = service;
    }

    public HttpResponse Send(HttpRequest request)
    {
        if (!_services.TryGetValue(request.To, out var service))
        {
            throw new InvalidOperationException($"unknown service: {request.To}");
        }
        return service.Handle(request);
    }
}
// [/network]

// [sidecar]
// The process boundary is simulated: the app and this sidecar are two objects in one
// process, and the "network" between them is a method call. A real sidecar is a
// separate process or container deployed with each service instance.
//
// The x-client-identity header stands in for mutual TLS. A real sidecar presents a
// certificate on an encrypted connection; here it is a plain header, and inventory
// only checks that the header is present, which is not secure.
class Sidecar(string serviceName, IOutbound upstream, int maxRetries) : IOutbound
{
    private int _maxRetries = maxRetries;

    public int Requests { get; private set; }
    public int Attempts { get; private set; }
    public int Retries { get; private set; }
    public int Failures { get; private set; }

    public HttpResponse Send(HttpRequest request)
    {
        Requests++;
        var outgoing = Http.WithHeader(request, "x-client-identity", serviceName);

        // Retrying is safe here only because the call is an idempotent GET, and only a
        // 503 is retried. Other statuses, such as 401, are returned as they are.
        var attemptsHere = 0;
        HttpResponse response;
        do
        {
            attemptsHere++;
            Attempts++;
            response = upstream.Send(outgoing);
        } while (response.Status == 503 && attemptsHere <= _maxRetries);

        Retries += attemptsHere - 1;
        if (response.Status >= 400)
        {
            Failures++;
        }
        Console.WriteLine(FormattableString.Invariant(
            $"[sidecar {serviceName}] {request.Method} {request.To}{request.Path} -> {response.Status} (attempts {attemptsHere})"));
        return response;
    }

    public void SetMaxRetries(int n)
    {
        _maxRetries = n;
        Console.WriteLine(FormattableString.Invariant(
            $"[sidecar {serviceName}] config reloaded: max retries {n}"));
    }
}
// [/sidecar]

// [app]
// There is no identity, retry or metrics code here: that all lives in the sidecar.
// Real meshes usually redirect the app's traffic to the sidecar transparently (for
// example with iptables rules), so the app code does not change at all. Here the
// sidecar is handed in explicitly as an IOutbound.
class OrderService(IOutbound outbound)
{
    public HttpResponse CheckStock(string sku)
    {
        var response = outbound.Send(new HttpRequest(
            "GET",
            "inventory",
            $"/stock/{sku}",
            new Dictionary<string, string>()));
        Console.WriteLine(FormattableString.Invariant(
            $"[orders] stock {sku}: {response.Status} {response.Body}"));
        return response;
    }
}
// [/app]
