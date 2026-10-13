// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [usage]
var legacy = new LegacyMonolith();
var modern = new ModernService();
var facade = new StranglerFacade(legacy, modern);

static void Send(StranglerFacade facade, string path)
{
    var r = facade.Handle(path);
    Console.WriteLine(FormattableString.Invariant($"GET {path} -> {r.Status} from {r.ServedBy.ToString().ToLowerInvariant()}: {r.Body}"));
}

Send(facade, "/products"); // 200 from legacy: 3 products
Send(facade, "/orders/42"); // 200 from legacy: order 42, 2 items

facade.Migrate("products");
Send(facade, "/products"); // 200 from modern: 3 products

facade.Migrate("orders"); // too early: the modern store has no orders yet
Send(facade, "/orders/42"); // 404 from modern: order 42 not found
facade.Rollback("orders");
Send(facade, "/orders/42"); // 200 from legacy again

Migration.CopyOrders(legacy, modern); // 1 order copied
facade.Migrate("orders");
Send(facade, "/orders/42"); // 200 from modern: order 42, 2 items

facade.RetireLegacy(); // refused: invoices still routed to legacy
facade.Migrate("invoices");
Send(facade, "/invoices/42"); // 200 from modern: invoice for order 42: 2 lines
facade.RetireLegacy(); // succeeds: nothing routes to legacy any more

Console.WriteLine(FormattableString.Invariant($"calls: legacy {legacy.Calls}, modern {modern.Calls}")); // legacy 3, modern 4
// [/usage]

// [http]
/** What either system answers: a status code and a body. */
record Reply(int Status, string Body);

/** What the facade hands back: the reply plus which system produced it. */
record Routed(int Status, string Body, Target ServedBy);

static class Http
{
    /** "/products" -> ("products", ""), "/orders/42" -> ("orders", "42"). */
    public static (string Feature, string Id) ParsePath(string path)
    {
        var parts = path.Split('/'); // "/orders/42" -> ["", "orders", "42"]
        return (parts.Length > 1 ? parts[1] : "", parts.Length > 2 ? parts[2] : "");
    }
}
// [/http]

// [legacy]
record OrderRecord(string Id, int Items);

// The old code being strangled. It is never edited during the migration.
class LegacyMonolith
{
    public int Calls { get; private set; }
    private readonly List<string> _products = ["p-1", "p-2", "p-3"];
    private readonly List<OrderRecord> _orders = [new OrderRecord("42", 2)];

    public Reply Handle(string path)
    {
        Calls++;
        var (feature, id) = Http.ParsePath(path);
        var order = _orders.Find(o => o.Id == id);
        switch (feature)
        {
            case "products":
                return new Reply(200, FormattableString.Invariant($"{_products.Count} products"));
            case "orders":
                return order is not null
                    ? new Reply(200, FormattableString.Invariant($"order {order.Id}, {order.Items} items"))
                    : new Reply(404, $"order {id} not found");
            case "invoices":
                return order is not null
                    ? new Reply(200, FormattableString.Invariant($"invoice for order {order.Id}: {order.Items} lines"))
                    : new Reply(404, $"order {id} not found");
            default:
                throw new InvalidOperationException($"legacy has no feature \"{feature}\""); // programmer bug, never exercised
        }
    }

    /** A copy of the order list, which the migration reads. */
    public List<OrderRecord> OrdersSnapshot() => _orders.ConvertAll(o => o with { });
}
// [/legacy]

// [modern]
class ModernService
{
    public int Calls { get; private set; }
    // The modern catalog was built with its own copy of the products before this example starts.
    private readonly List<string> _products = ["p-1", "p-2", "p-3"];
    private readonly List<OrderRecord> _orders = []; // empty until the migration imports orders

    public void ImportOrder(OrderRecord record)
    {
        _orders.Add(record with { });
    }

    public Reply Handle(string path)
    {
        Calls++;
        var (feature, id) = Http.ParsePath(path);
        var order = _orders.Find(o => o.Id == id);
        switch (feature)
        {
            case "products":
                return new Reply(200, FormattableString.Invariant($"{_products.Count} products"));
            case "orders":
                return order is not null
                    ? new Reply(200, FormattableString.Invariant($"order {order.Id}, {order.Items} items"))
                    : new Reply(404, $"order {id} not found"); // a wrong answer, not a crash
            case "invoices":
                return order is not null
                    ? new Reply(200, FormattableString.Invariant($"invoice for order {order.Id}: {order.Items} lines"))
                    : new Reply(404, $"order {id} not found");
            default:
                throw new InvalidOperationException($"modern has no feature \"{feature}\""); // programmer bug, never exercised
        }
    }
}
// [/modern]

// [migration]
static class Migration
{
    // Moving the data is usually the hard part (dual writes, change data capture, sync jobs).
    // One explicit copy stands in for all of that here.
    public static int CopyOrders(LegacyMonolith legacy, ModernService modern)
    {
        var records = legacy.OrdersSnapshot();
        foreach (var record in records)
        {
            modern.ImportOrder(record);
        }
        Console.WriteLine(FormattableString.Invariant($"[migration] orders copied to the modern store: {records.Count}"));
        return records.Count;
    }
}
// [/migration]

// [facade]
enum Target { Legacy, Modern }

// Real facades are reverse proxies, API gateways or load-balancer rules, sometimes with
// feature flags or a percentage of traffic. Here the facade is an in-process object, and a
// feature moves all at once by an explicit call.
class StranglerFacade
{
    private static readonly string[] Features = ["products", "orders", "invoices"];

    private readonly LegacyMonolith _legacy;
    private readonly ModernService _modern;
    // Only ever read by key: RetireLegacy walks Features, so no output depends on dictionary order.
    private readonly Dictionary<string, Target> _routes = [];

    public bool Retired { get; private set; }

    public StranglerFacade(LegacyMonolith legacy, ModernService modern)
    {
        _legacy = legacy;
        _modern = modern;
        foreach (var feature in Features)
        {
            _routes[feature] = Target.Legacy;
        }
    }

    public Routed Handle(string path)
    {
        var (feature, _) = Http.ParsePath(path);
        if (!_routes.TryGetValue(feature, out var target))
        {
            throw new InvalidOperationException($"facade has no route for \"{feature}\""); // programmer bug, never exercised
        }
        var reply = target == Target.Legacy ? _legacy.Handle(path) : _modern.Handle(path);
        return new Routed(reply.Status, reply.Body, target);
    }

    public void Migrate(string feature)
    {
        _routes[feature] = Target.Modern;
        Console.WriteLine($"[facade] {feature} -> modern");
    }

    // Rollback only works here because nothing is written in this scenario, so the legacy side
    // still has current data. In a real system, writes made through the modern side must flow
    // back to the legacy side, or a rollback loses them.
    public void Rollback(string feature)
    {
        _routes[feature] = Target.Legacy;
        Console.WriteLine($"[facade] {feature} -> legacy (rollback)");
    }

    /** The legacy system can go only when no feature is routed to it. */
    public bool RetireLegacy()
    {
        var stillLegacy = Features.Where(f => _routes[f] == Target.Legacy).ToList();
        if (stillLegacy.Count > 0)
        {
            Console.WriteLine($"[facade] cannot retire legacy: {string.Join(", ", stillLegacy)} still routed to it");
            return false;
        }
        Retired = true;
        Console.WriteLine("[facade] legacy retired");
        return true;
    }
}
// [/facade]
