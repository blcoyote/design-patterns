using System;
using System.Collections.Generic;
using System.Globalization;

// [usage]
var bus = new InProcessEventBus();
var host = new ModuleHost(bus);
// Registration order is start order; ordering needs catalog, so catalog is registered first.
var catalog = host.Register("catalog", Array.Empty<string>(), CatalogModule.Create);
var ordering = host.Register("ordering", new[] { "catalog" }, OrderingModule.Create);
var shipping = host.Register("shipping", Array.Empty<string>(), ShippingModule.Create);
Console.WriteLine($"modules started: {string.Join(", ", host.Started)}");

// A client outside the monolith talks to the public APIs only.
var placed = ordering.PlaceOrder("cust-42", new List<OrderLineRequest>
{
    new("sku-1", 2),
    new("sku-2", 1),
});
Console.WriteLine($"{placed.OrderId} placed for cust-42, total {Money.FormatCents(placed.TotalCents)}");

// Unknown product: a rejected result, not an exception. No id is assigned.
var rejected = ordering.PlaceOrder("cust-42", new List<OrderLineRequest> { new("sku-9", 1) });
Console.WriteLine($"rejected: {rejected.Reason}");

// Catalog changes its own price; Ordering kept its own copy of the old one.
catalog.SetPrice("sku-1", 2499);
var total = ordering.OrderTotal("order-1");
Console.WriteLine(
    total is null ? "order-1 total unknown" : $"order-1 total still {Money.FormatCents(total.Value)}");

Console.WriteLine($"shipping status for order-1: {shipping.StatusFor("order-1")}");

// Shipping never declared catalog, so the host refuses the lookup.
try
{
    host.Use<ICatalogApi>("shipping", "catalog");
}
catch (InvalidOperationException err)
{
    Console.WriteLine($"rejected: {err.Message}");
}
// [/usage]

// [contracts]
// The public contracts the modules share (a "published language"). Nothing internal lives
// here: no module's records, stores or implementation classes, only what crosses a boundary.

/// What Catalog's API returns. Deliberately NOT Catalog's internal record.
record ProductInfo(string Sku, string Name, long PriceCents);

interface ICatalogApi
{
    ProductInfo? GetProduct(string sku);
    void SetPrice(string sku, long priceCents);
}

record OrderLineRequest(string Sku, int Quantity);

/// A rejection is a normal result, not an exception: OrderId is "" and Reason is set.
/// OrderId is the empty string when the order was rejected; Reason is the empty string when it was accepted.
record PlaceOrderResult(bool Accepted, string OrderId, long TotalCents, string Reason);

interface IOrderingApi
{
    PlaceOrderResult PlaceOrder(string customerId, List<OrderLineRequest> lines);
    long? OrderTotal(string orderId);
}

/// The integration event Ordering publishes. Shipping depends on this shape, not on Ordering.
record OrderPlaced(string OrderId, string CustomerId, long TotalCents);

interface IShippingApi
{
    /// "ready to ship" or "unknown".
    string StatusFor(string orderId);
}

// C# has no equivalent of a type-level map from module name to API type, so module names are
// plain strings ("catalog", "ordering", "shipping") and the host's generic Use<T> names the API type.

/// Money is integer cents everywhere. Formats 6997 as "69.97" with integer arithmetic only (no floats).
static class Money
{
    public static string FormatCents(long cents)
    {
        long whole = cents / 100;
        long fraction = cents % 100;
        return $"{whole.ToString(CultureInfo.InvariantCulture)}.{fraction.ToString("D2", CultureInfo.InvariantCulture)}";
    }
}
// [/contracts]

// [eventBus]
/// <summary>
/// An in-process event bus for OrderPlaced. Publish calls every handler synchronously, in
/// subscription order, on the caller's own call stack: same process, so no network. A real
/// modular monolith often pairs this with an outbox, so the event commits together with the
/// publishing module's own data. This bus has no outbox and does not persist anything.
/// (C# has built-in events, but a plain handler list keeps the pattern explicit.)
/// </summary>
class InProcessEventBus
{
    private readonly List<Action<OrderPlaced>> _handlers = new();

    public void Subscribe(Action<OrderPlaced> handler)
    {
        _handlers.Add(handler);
    }

    public void Publish(OrderPlaced @event)
    {
        // Iterate a snapshot: a handler subscribed during Publish first runs on the next Publish.
        foreach (var handler in _handlers.ToArray()) handler(@event);
    }
}
// [/eventBus]

// [host]
/// <summary>
/// What a module's factory receives: the shared bus and a way to reach the modules it declared.
/// </summary>
sealed class ModuleContext
{
    private readonly ModuleHost _host;
    private readonly string _module;

    public ModuleContext(InProcessEventBus bus, ModuleHost host, string module)
    {
        Bus = bus;
        _host = host;
        _module = module;
    }

    public InProcessEventBus Bus { get; }

    /// Looks up a target module's API on behalf of this module: the host checks the declared dependencies.
    public T Use<T>(string target) where T : class => _host.Use<T>(_module, target);
}

/// <summary>
/// The composition root of the single deployable. It starts each module, hands it a
/// ModuleContext, and refuses any lookup of a module the requester did not declare.
/// </summary>
class ModuleHost
{
    private readonly InProcessEventBus _bus;
    private readonly Dictionary<string, object> _apis = new();
    private readonly Dictionary<string, string[]> _dependencies = new();
    private readonly List<string> _started = new();

    public ModuleHost(InProcessEventBus bus)
    {
        _bus = bus;
        Started = _started.AsReadOnly();
    }

    /// Names of the started modules, in registration order. A read-only view: callers cannot add to it.
    public IReadOnlyList<string> Started { get; }

    /// Registering is starting: the factory runs immediately and only its returned API is kept.
    public TApi Register<TApi>(string name, string[] dependsOn, Func<ModuleContext, TApi> factory)
        where TApi : class
    {
        _dependencies[name] = dependsOn;
        var ctx = new ModuleContext(_bus, this, name);
        var api = factory(ctx);
        _apis[name] = api;
        _started.Add(name);
        return api;
    }

    /// <summary>
    /// The boundary check: a module may only reach modules it declared. In a real codebase an
    /// architecture test enforces the same rule (ArchUnit/NetArchTest, import-linter, Go's internal/ packages).
    /// </summary>
    public T Use<T>(string requester, string target) where T : class
    {
        if (!_dependencies.TryGetValue(requester, out var declared) || Array.IndexOf(declared, target) < 0)
        {
            throw new InvalidOperationException($"{requester} does not declare a dependency on {target}");
        }
        if (!_apis.TryGetValue(target, out var api)) throw new InvalidOperationException($"{target} is not started");
        // The registry holds every module's API as object, because the APIs have different types.
        // The caller names the API type it expects; a wrong T would throw InvalidCastException.
        return (T)api;
    }
}
// [/host]

// [catalog]
/// <summary>
/// The Catalog module. In C# the compiler enforces the hiding: CatalogModule is a static class
/// whose only public member is Create, which returns the ICatalogApi interface. The internal
/// record and the implementation are private nested types, so no other code can even name them.
/// </summary>
static class CatalogModule
{
    public static ICatalogApi Create(ModuleContext ctx) => new Implementation();

    /// Catalog's internal record. It never leaves the module: SupplierCode is internal only.
    private sealed class CatalogRecord
    {
        public CatalogRecord(string sku, string name, long priceCents, string supplierCode)
        {
            Sku = sku;
            Name = name;
            PriceCents = priceCents;
            SupplierCode = supplierCode;
        }

        public string Sku { get; }
        public string Name { get; }
        public long PriceCents { get; set; }
        public string SupplierCode { get; }
    }

    private sealed class Implementation : ICatalogApi
    {
        private readonly Dictionary<string, CatalogRecord> _records = new()
        {
            ["sku-1"] = new CatalogRecord("sku-1", "Widget", 1999, "SUP-W"),
            ["sku-2"] = new CatalogRecord("sku-2", "Gadget", 2999, "SUP-G"),
        };

        public ProductInfo? GetProduct(string sku)
        {
            if (!_records.TryGetValue(sku, out var record)) return null;
            // Map the internal record to the public ProductInfo; SupplierCode stays inside.
            return new ProductInfo(record.Sku, record.Name, record.PriceCents);
        }

        public void SetPrice(string sku, long priceCents)
        {
            if (!_records.TryGetValue(sku, out var record)) return;
            record.PriceCents = priceCents;
            Console.WriteLine($"[catalog] {sku} repriced to {Money.FormatCents(priceCents)}");
        }
    }
}
// [/catalog]

// [ordering]
/// <summary>
/// The Ordering module. It asks the host for Catalog once, at creation: that call succeeds
/// only because "catalog" is in Ordering's declared dependencies. Its orders live in a private
/// nested class, so other modules reach them only through IOrderingApi.
/// </summary>
static class OrderingModule
{
    public static IOrderingApi Create(ModuleContext ctx) => new Implementation(ctx, ctx.Use<ICatalogApi>("catalog"));

    /// One stored order line. UnitPriceCents is Ordering's own copy, taken at placement time.
    private sealed record StoredOrderLine(string Sku, int Quantity, long UnitPriceCents);

    private sealed record StoredOrder(string OrderId, string CustomerId, List<StoredOrderLine> Lines);

    private sealed class Implementation : IOrderingApi
    {
        private readonly ModuleContext _ctx;
        private readonly ICatalogApi _catalog;
        private readonly Dictionary<string, StoredOrder> _orders = new();
        private int _nextOrderNumber = 1; // counter-based ids, never timestamps

        public Implementation(ModuleContext ctx, ICatalogApi catalog)
        {
            _ctx = ctx;
            _catalog = catalog;
        }

        public PlaceOrderResult PlaceOrder(string customerId, List<OrderLineRequest> lines)
        {
            var storedLines = new List<StoredOrderLine>();
            foreach (var line in lines)
            {
                var product = _catalog.GetProduct(line.Sku);
                if (product is null)
                {
                    // Reject before assigning an id: nothing is stored and nothing is published.
                    return new PlaceOrderResult(false, "", 0, $"unknown product {line.Sku}");
                }
                storedLines.Add(new StoredOrderLine(line.Sku, line.Quantity, product.PriceCents));
            }

            long totalCents = 0;
            foreach (var line in storedLines) totalCents += line.UnitPriceCents * line.Quantity;

            var orderId = $"order-{_nextOrderNumber++}";
            _orders[orderId] = new StoredOrder(orderId, customerId, storedLines); // save the copied prices
            _ctx.Bus.Publish(new OrderPlaced(orderId, customerId, totalCents));
            return new PlaceOrderResult(true, orderId, totalCents, "");
        }

        public long? OrderTotal(string orderId)
        {
            if (!_orders.TryGetValue(orderId, out var order)) return null;
            // Computed from Ordering's own stored copy: Catalog is never called here.
            long totalCents = 0;
            foreach (var line in order.Lines) totalCents += line.UnitPriceCents * line.Quantity;
            return totalCents;
        }
    }
}
// [/ordering]

// [shipping]
/// <summary>
/// The Shipping module. It declares no module dependencies: it knows only the OrderPlaced
/// contract and learns about orders by subscribing to the bus.
/// </summary>
static class ShippingModule
{
    public static IShippingApi Create(ModuleContext ctx)
    {
        var shipping = new Implementation();
        ctx.Bus.Subscribe(shipping.OnOrderPlaced);
        return shipping;
    }

    private sealed record Shipment(string ShipmentId, string Status);

    private sealed class Implementation : IShippingApi
    {
        private readonly Dictionary<string, Shipment> _shipments = new(); // keyed by orderId
        private int _nextShipmentNumber = 1; // its own counter, independent of Ordering's

        public void OnOrderPlaced(OrderPlaced @event)
        {
            var shipmentId = $"ship-{_nextShipmentNumber++}";
            _shipments[@event.OrderId] = new Shipment(shipmentId, "ready to ship");
            Console.WriteLine($"[shipping] shipment {shipmentId} created for {@event.OrderId}");
        }

        public string StatusFor(string orderId) =>
            _shipments.TryGetValue(orderId, out var shipment) ? shipment.Status : "unknown";
    }
}
// [/shipping]
