using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// Usage: production wiring plugs the real database adapter into the core.
var controller = new HttpOrderController(new PlaceOrderService(new PostgresOrderRepository()));
controller.HandlePost("cust-42", new List<LineItem>
{
    new("WIDGET", 19.99m),
    new("GADGET", 29.99m),
});

// [test]
// Test harness: the SAME PlaceOrderService, the SAME IPlaceOrderUseCase port —
// only the driven adapter changes. The core is never touched, recompiled or
// mocked; it just receives a different implementation of IOrderRepository.
TestPlaceOrderWritesToRepository();

void TestPlaceOrderWritesToRepository()
{
    var repo = new InMemoryOrderRepository();
    IPlaceOrderUseCase useCase = new PlaceOrderService(repo);

    useCase.Execute(new PlaceOrderCommand("cust-1", new List<LineItem> { new("WIDGET", 9.99m) }));

    if (repo.Saved.Count != 1) throw new InvalidOperationException("expected exactly one saved order");
    Console.WriteLine("test passed: order persisted through the in-memory adapter");
}
// [/test]

record LineItem(string Sku, decimal Price);
record PlaceOrderCommand(string CustomerId, List<LineItem> Items);

// [port]
// Driving port: the only way into the core. Adapters depend on this
// interface; the core never depends on them.
interface IPlaceOrderUseCase
{
    Order Execute(PlaceOrderCommand command);
}
// [/port]

// [order]
// Domain entity, part of the core. It knows nothing about HTTP, SQL or any
// adapter — only its own rules.
class Order
{
    public string CustomerId { get; }
    public List<LineItem> Lines { get; } = new();

    public Order(string customerId)
    {
        CustomerId = customerId;
    }

    public void AddLine(LineItem item)
    {
        if (item.Price <= 0) throw new InvalidOperationException("line item must have a positive price");
        Lines.Add(item);
    }

    public decimal Total => Lines.Sum(l => l.Price);
}
// [/order]

// [repoPort]
// Driven port: the core declares the capability it needs, in its own
// vocabulary. It has no idea Postgres or an in-memory list will answer it.
interface IOrderRepository
{
    void Save(Order order);
}
// [/repoPort]

// [service]
// The core's application service. It implements the driving port and
// depends only on the driven port's interface — never a concrete adapter.
class PlaceOrderService : IPlaceOrderUseCase
{
    private readonly IOrderRepository _orders;

    public PlaceOrderService(IOrderRepository orders)
    {
        _orders = orders;
    }

    public Order Execute(PlaceOrderCommand command)
    {
        var order = new Order(command.CustomerId);
        foreach (var item in command.Items) order.AddLine(item);
        _orders.Save(order);
        return order;
    }
}
// [/service]

// [postgres]
// Driven adapter #1: talks to a real database. Swappable because it is
// just another IOrderRepository as far as the core is concerned.
class PostgresOrderRepository : IOrderRepository
{
    public void Save(Order order)
    {
        Db.DatabaseQuery($"INSERT INTO orders (customer_id, total) VALUES ('{order.CustomerId}', {order.Total.ToString("F2", CultureInfo.InvariantCulture)})");
    }
}
// [/postgres]

// [inMemory]
// Driven adapter #2: an in-memory stand-in used by tests. Same port, zero
// infrastructure, and the core cannot tell the difference.
class InMemoryOrderRepository : IOrderRepository
{
    public List<Order> Saved { get; } = new();

    public void Save(Order order)
    {
        Saved.Add(order);
    }
}

// A true Null Object: same port, but it discards every write instead of
// keeping one. A safe, crash-free default for local development before a
// real adapter is wired in -- unlike InMemoryOrderRepository, nothing can be
// read back out of it.
class NullOrderRepository : IOrderRepository
{
    public void Save(Order order)
    {
        // intentionally does nothing
    }
}
// [/inMemory]

// [controller]
// Driving adapter: translates an inbound HTTP request into the command the
// driving port understands, and calls it. It depends on the port, never on
// PlaceOrderService directly.
class HttpOrderController
{
    private readonly IPlaceOrderUseCase _useCase;

    public HttpOrderController(IPlaceOrderUseCase useCase)
    {
        _useCase = useCase;
    }

    public (int Status, string CustomerId) HandlePost(string customerId, List<LineItem> items)
    {
        var order = _useCase.Execute(new PlaceOrderCommand(customerId, items));
        return (201, order.CustomerId);
    }
}
// [/controller]

static class Db
{
    public static void DatabaseQuery(string sql)
    {
        Console.WriteLine($"SQL: {sql}");
    }
}
