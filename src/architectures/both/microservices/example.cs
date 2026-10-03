using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
var inventory = new InventoryService();
var inventoryClient = new InventoryServiceClient(inventory);
var payments = new PaymentsService();
var paymentsBreaker = new CircuitBreaker(/* failureThreshold */ 3);
var broker = new MessageBroker();
var shipping = new ShippingService();
broker.Subscribe(shipping.OnOrderPlaced);
var orders = new OrderService(inventoryClient, paymentsBreaker, payments, broker);
var gateway = new ApiGateway(orders);

void Report(PlaceOrderResult order)
{
    Console.WriteLine($"{order.OrderId}: total=${order.Total.ToString("F2", CultureInfo.InvariantCulture)} status={order.Status} reason=\"{order.Reason}\"");
}

// Order 1: two lines, same sku -- the second lookup is a cache hit. Payments is healthy, so it is paid.
Report(gateway.PlaceOrder(new List<OrderLine>
{
    new("sku-1", 1),
    new("sku-1", 2),
}));

// The payment processor goes down -- deterministic, flipped explicitly, not by a timer.
payments.SetDown(true);

// Orders 2, 3 and 4: the processor is down for all three, so the breaker counts three
// failures in a row and trips open on the third one.
Report(gateway.PlaceOrder(new List<OrderLine> { new("sku-2", 1) }));
Report(gateway.PlaceOrder(new List<OrderLine> { new("sku-2", 1) }));
Report(gateway.PlaceOrder(new List<OrderLine> { new("sku-1", 1) }));
Console.WriteLine($"PaymentsService calls so far: {payments.Calls}, breaker={(paymentsBreaker.IsOpen ? "OPEN" : "CLOSED")}");

// Order 5: the breaker is now open -- it fails fast, PaymentsService.Charge is never called.
Report(gateway.PlaceOrder(new List<OrderLine> { new("sku-2", 1) }));
Console.WriteLine($"PaymentsService calls after breaker opened: {payments.Calls}");

Console.WriteLine($"InventoryService product lookups: {inventory.Calls}");
Console.WriteLine($"OrderService recorded {orders.RecordedOrders.Count} orders, {orders.RecordedOrders.Count(o => o.Status == "PAID")} paid");
Console.WriteLine($"ShippingService received {shipping.Received.Count} OrderPlaced events");
// [/usage]

record OrderLine(string Sku, int Quantity);

/// Orders' own model of a product -- only what Orders needs, in Orders' own vocabulary.
record Product(string Sku, string Name, decimal Price);

record OrderPlacedEvent(string OrderId, List<OrderLine> Lines, decimal Total);

record OrderRecord(string OrderId, decimal Total, string Status);

record PlaceOrderResult(string OrderId, decimal Total, string Status, string Reason);

// [inventory]
/// Inventory's own wire shape. Orders never sees this directly -- only through the client below.
record ProductDto(string Sku, string DisplayName, int UnitPriceCents);

/// The Inventory microservice: its own process, its own private store.
class InventoryService
{
    public int Calls { get; private set; }

    private readonly Dictionary<string, ProductDto> _products = new()
    {
        ["sku-1"] = new ProductDto("sku-1", "Widget", 1999),
        ["sku-2"] = new ProductDto("sku-2", "Gadget", 2999),
    };

    public ProductDto FindProduct(string sku)
    {
        Calls++;
        if (!_products.TryGetValue(sku, out var dto)) throw new InvalidOperationException($"product {sku} not found");
        return dto;
    }
}
// [/inventory]

// [inventoryClient]
/// <summary>
/// Orders' client proxy for Inventory: same interface shape Orders would use for a local
/// call, so Orders never deals with Inventory's transport directly (Proxy). It also reads
/// through a cache before calling out (Cache-Aside), and converts Inventory's ProductDto
/// into Orders' own Product model (Adapter) so Inventory's wire shape never leaks in.
/// </summary>
class InventoryServiceClient
{
    private readonly InventoryService _inventory;
    private readonly Dictionary<string, Product> _cache = new();

    public InventoryServiceClient(InventoryService inventory)
    {
        _inventory = inventory;
    }

    public Product GetProduct(string sku)
    {
        if (_cache.TryGetValue(sku, out var cached)) return cached; // cache hit -- Inventory is never called

        var dto = _inventory.FindProduct(sku); // cache miss -- load from the service
        var product = new Product(dto.Sku, dto.DisplayName, dto.UnitPriceCents / 100m);
        _cache[sku] = product; // populate the cache for next time
        return product;
    }
}
// [/inventoryClient]

// [breaker]
enum BreakerState
{
    Closed,
    Open,
}

/// <summary>
/// A deliberately minimal circuit breaker: no timers, no clock -- just a failure counter.
/// Once <c>failureThreshold</c> calls in a row have failed it opens and stays open, failing
/// every further call immediately without ever invoking the wrapped function again.
/// </summary>
class CircuitBreaker
{
    private readonly int _failureThreshold;
    private BreakerState _state = BreakerState.Closed;
    private int _failureCount;

    public CircuitBreaker(int failureThreshold)
    {
        _failureThreshold = failureThreshold;
    }

    public bool IsOpen => _state == BreakerState.Open;

    public T Call<T>(Func<T> fn)
    {
        if (_state == BreakerState.Open)
        {
            throw new InvalidOperationException("circuit open -- failing fast"); // fn() never runs
        }
        try
        {
            var result = fn();
            _failureCount = 0;
            return result;
        }
        catch
        {
            _failureCount++;
            if (_failureCount >= _failureThreshold) _state = BreakerState.Open;
            throw;
        }
    }
}
// [/breaker]

// [payments]
/// The Payments microservice: its own process, its own private store.
class PaymentsService
{
    private bool _down;

    public int Calls { get; private set; }

    /// Flips the processor's health. Deterministic: only ever changed by an explicit call, never a timer.
    public void SetDown(bool down)
    {
        _down = down;
    }

    public string Charge(string orderId, decimal amount)
    {
        Calls++;
        if (_down) throw new InvalidOperationException($"payment processor unavailable for order {orderId}");
        return $"receipt-{orderId}-{amount.ToString(CultureInfo.InvariantCulture)}";
    }
}
// [/payments]

// [broker]
/// A simple in-process broker: publishers and subscribers only ever know this interface (Pub/Sub).
class MessageBroker
{
    private readonly List<Action<OrderPlacedEvent>> _subscribers = new();

    public void Subscribe(Action<OrderPlacedEvent> handler)
    {
        _subscribers.Add(handler);
    }

    public void Publish(OrderPlacedEvent @event)
    {
        foreach (var handler in _subscribers) handler(@event);
    }
}
// [/broker]

// [shipping]
/// The Shipping microservice. It only ever learns about an order by subscribing to the broker.
class ShippingService
{
    public List<OrderPlacedEvent> Received { get; } = new();

    public void OnOrderPlaced(OrderPlacedEvent @event)
    {
        Received.Add(@event);
    }
}
// [/shipping]

// [orders]
/// The Orders microservice: its own process, with its own private store of the orders it has recorded.
class OrderService
{
    private readonly Dictionary<string, OrderRecord> _orders = new();
    private readonly InventoryServiceClient _inventoryClient;
    private readonly CircuitBreaker _paymentsBreaker;
    private readonly PaymentsService _payments;
    private readonly MessageBroker _broker;

    public OrderService(InventoryServiceClient inventoryClient, CircuitBreaker paymentsBreaker, PaymentsService payments, MessageBroker broker)
    {
        _inventoryClient = inventoryClient;
        _paymentsBreaker = paymentsBreaker;
        _payments = payments;
        _broker = broker;
    }

    public List<OrderRecord> RecordedOrders => _orders.Values.ToList();

    public PlaceOrderResult PlaceOrder(string orderId, List<OrderLine> lines)
    {
        decimal total = 0m;
        foreach (var line in lines)
        {
            var product = _inventoryClient.GetProduct(line.Sku);
            total += product.Price * line.Quantity;
        }

        string status;
        string reason = "";
        try
        {
            _paymentsBreaker.Call(() => _payments.Charge(orderId, total));
            status = "PAID";
        }
        catch (Exception err)
        {
            status = "PAYMENT_FAILED";
            reason = err.Message;
        }

        // Orders records every order it handled in its own private store, paid or not.
        _orders[orderId] = new OrderRecord(orderId, total, status);

        // Only a paid order is announced -- a failed one never reaches Shipping.
        if (status == "PAID") _broker.Publish(new OrderPlacedEvent(orderId, lines, total));

        return new PlaceOrderResult(orderId, total, status, reason);
    }
}
// [/orders]

// [gateway]
/// The API Gateway: the one entry point clients see, hiding three separate services behind it (Facade).
class ApiGateway
{
    private int _nextOrderId = 1; // counter-based ids, never timestamps
    private readonly OrderService _orders;

    public ApiGateway(OrderService orders)
    {
        _orders = orders;
    }

    public PlaceOrderResult PlaceOrder(List<OrderLine> lines)
    {
        var orderId = $"order-{_nextOrderId++}";
        return _orders.PlaceOrder(orderId, lines);
    }
}
// [/gateway]
