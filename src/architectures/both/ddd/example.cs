using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// Usage
var repository = new InMemoryOrderRepository();
var acl = new OrderingToShippingAcl(new ShippingService());
var appService = new OrderApplicationService(repository, acl);

var draft = appService.StartOrder("order-1", "cust-42");
var placed = appService.PlaceOrder(draft.Id, new List<OrderLine>
{
    new("WIDGET", Money.Of(19.99m), 2),
    new("GADGET", Money.Of(29.99m), 1),
});
Console.WriteLine($"order {placed.Id} placed, total: {placed.Total}");

// Invariant in action: the aggregate refuses to grow once it has been placed.
try
{
    placed.AddLine(new OrderLine("LATE-ITEM", Money.Of(5m), 1));
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"rejected: {ex.Message}");
}

// [money]
// Immutable value object: no identity, compared by value, every operation returns a new instance.
class Money
{
    private readonly long _cents;
    public string Currency { get; }

    private Money(long cents, string currency)
    {
        _cents = cents;
        Currency = currency;
    }

    public static Money Of(decimal amount, string currency = "USD") =>
        new(Convert.ToInt64(Math.Round(amount * 100, MidpointRounding.AwayFromZero)), currency);

    public Money Add(Money other)
    {
        AssertSameCurrency(other);
        return new Money(_cents + other._cents, Currency);
    }

    public bool Equals(Money other) => _cents == other._cents && Currency == other.Currency;

    public override string ToString() => $"{(_cents / 100m).ToString("F2", CultureInfo.InvariantCulture)} {Currency}";

    private void AssertSameCurrency(Money other)
    {
        if (other.Currency != Currency) throw new InvalidOperationException("currency mismatch");
    }
}
// [/money]

// [orderLine]
// Entity: has identity (sku + its position on the order) even though its fields never change.
class OrderLine
{
    public string Sku { get; }
    public Money UnitPrice { get; }
    public int Quantity { get; }

    public OrderLine(string sku, Money unitPrice, int quantity)
    {
        Sku = sku;
        UnitPrice = unitPrice;
        Quantity = quantity;
    }

    public Money LineTotal
    {
        get
        {
            var total = Money.Of(0, UnitPrice.Currency);
            for (var i = 0; i < Quantity; i++) total = total.Add(UnitPrice);
            return total;
        }
    }
}
// [/orderLine]

// [orderPlaced]
interface IDomainEvent
{
    string Name { get; }
    DateTime OccurredAt { get; }
}

// Domain event: something that happened inside the Ordering bounded context.
class OrderPlaced : IDomainEvent
{
    public string Name => "OrderPlaced";
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
    public string OrderId { get; }
    public string CustomerId { get; }
    public Money Total { get; }

    public OrderPlaced(string orderId, string customerId, Money total)
    {
        OrderId = orderId;
        CustomerId = customerId;
        Total = total;
    }
}
// [/orderPlaced]

// Strategy: a domain policy injected into the aggregate instead of hardcoded inside it.
interface IOrderPolicy
{
    bool IsSatisfiedBy(Order order);
    string Describe();
}

class RequireAtLeastOneLine : IOrderPolicy
{
    public bool IsSatisfiedBy(Order order) => order.LineCount > 0;
    public string Describe() => "an order needs at least one line to be placed";
}

enum OrderStatus
{
    Draft,
    Placed,
}

// [order]
// Aggregate root: the only object outside the aggregate is allowed to reference directly.
class Order
{
    public string Id { get; }
    public string CustomerId { get; }
    private OrderStatus _status = OrderStatus.Draft;
    private readonly List<OrderLine> _lines = new();
    private readonly List<IDomainEvent> _events = new();

    private Order(string id, string customerId)
    {
        Id = id;
        CustomerId = customerId;
    }

    // Factory method: callers never build an Order with `new` directly.
    public static Order Create(string id, string customerId) => new(id, customerId);

    public int LineCount => _lines.Count;

    public void AddLine(OrderLine line)
    {
        // Invariant: a placed order can never be grown again — no matter who calls this,
        // or from where. The rule lives in the aggregate, not in every caller.
        if (_status != OrderStatus.Draft)
            throw new InvalidOperationException($"cannot add a line to order {Id}: already {_status.ToString().ToLowerInvariant()}");
        _lines.Add(line);
    }

    public Money Total => _lines.Aggregate(Money.Of(0), (sum, line) => sum.Add(line.LineTotal));

    public void Place(IOrderPolicy policy)
    {
        if (_status != OrderStatus.Draft) throw new InvalidOperationException($"order {Id} is already {_status.ToString().ToLowerInvariant()}");
        if (!policy.IsSatisfiedBy(this)) throw new InvalidOperationException($"cannot place order {Id}: {policy.Describe()}");
        _status = OrderStatus.Placed;
        _events.Add(new OrderPlaced(Id, CustomerId, Total));
    }

    // Events raised since the last call. The aggregate itself never publishes anything.
    public List<IDomainEvent> PullEvents()
    {
        var pulled = new List<IDomainEvent>(_events);
        _events.Clear();
        return pulled;
    }
}
// [/order]

// [orderRepo]
// Repository: a collection-like abstraction for loading and saving whole aggregates.
interface IOrderRepository
{
    Order? FindById(string id);
    void Save(Order order);
}

class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<string, Order> _orders = new();

    public Order? FindById(string id) => _orders.TryGetValue(id, out var order) ? order : null;

    public void Save(Order order) => _orders[order.Id] = order;
}
// [/orderRepo]

// [shipping]
// Shipping bounded context: its own vocabulary. It has never heard of an "Order".
class ShipmentRequested : IDomainEvent
{
    public string Name => "ShipmentRequested";
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
    public string ShipmentId { get; }
    public string RecipientId { get; }
    public Money Value { get; }

    public ShipmentRequested(string shipmentId, string recipientId, Money value)
    {
        ShipmentId = shipmentId;
        RecipientId = recipientId;
        Value = value;
    }
}

class ShippingService
{
    public void RequestShipment(ShipmentRequested requested) =>
        Console.WriteLine($"[shipping] shipment {requested.ShipmentId} requested for {requested.RecipientId}, value {requested.Value}");
}
// [/shipping]

// [acl]
// Anti-Corruption Layer: translates Ordering's language into Shipping's, so neither
// bounded context has to know the other's model. OrderPlaced never crosses the
// boundary as-is — only ShipmentRequested does.
class OrderingToShippingAcl
{
    private readonly ShippingService _shipping;

    public OrderingToShippingAcl(ShippingService shipping)
    {
        _shipping = shipping;
    }

    public void Translate(OrderPlaced evt)
    {
        var shipmentRequested = new ShipmentRequested($"ship-{evt.OrderId}", evt.CustomerId, evt.Total);
        _shipping.RequestShipment(shipmentRequested);
    }
}
// [/acl]

// [appService]
// Application service: Ordering's single entry point. No business rules of its own.
class OrderApplicationService
{
    private readonly IOrderPolicy _policy = new RequireAtLeastOneLine();
    private readonly IOrderRepository _repository;
    private readonly OrderingToShippingAcl _acl;

    public OrderApplicationService(IOrderRepository repository, OrderingToShippingAcl acl)
    {
        _repository = repository;
        _acl = acl;
    }

    public Order StartOrder(string id, string customerId)
    {
        var order = Order.Create(id, customerId);
        _repository.Save(order);
        return order;
    }

    public Order PlaceOrder(string orderId, List<OrderLine> lines)
    {
        var order = _repository.FindById(orderId) ?? throw new InvalidOperationException($"no such order: {orderId}");

        foreach (var line in lines) order.AddLine(line);
        order.Place(_policy);
        _repository.Save(order);

        // The application service plays observer: it collects what the aggregate raised
        // in-process, and dispatches each event onward — here, straight through the ACL.
        foreach (var evt in order.PullEvents())
        {
            if (evt is OrderPlaced placed) _acl.Translate(placed);
        }
        return order;
    }
}
// [/appService]
