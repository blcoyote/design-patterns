using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// Usage
var controller = new OrderController(new OrderService(new SqlOrderRepository()));
controller.HandlePlaceOrder("cust-42", new List<LineItem>
{
    new("WIDGET", 19.99m),
    new("GADGET", 29.99m),
});

// Anti-pattern in action: the controller reaches past three layers directly into the database.
controller.HandleDebugLookup("42");

record LineItem(string Sku, decimal Price);

// [order]
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

interface IOrderRepository
{
    void Save(Order order);
}

// [save]
class SqlOrderRepository : IOrderRepository
{
    public void Save(Order order)
    {
        Db.DatabaseQuery($"INSERT INTO orders (customer_id, total) VALUES ('{order.CustomerId}', {order.Total.ToString("F2", CultureInfo.InvariantCulture)})");
    }
}
// [/save]

// [placeOrder]
class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }

    public Order PlaceOrder(string customerId, List<LineItem> items)
    {
        var order = new Order(customerId);
        foreach (var item in items) order.AddLine(item);
        _repository.Save(order);
        return order;
    }
}
// [/placeOrder]

// [controller]
class OrderController
{
    private readonly OrderService _service;

    public OrderController(OrderService service)
    {
        _service = service;
    }

    public (int Status, string OrderId) HandlePlaceOrder(string customerId, List<LineItem> items)
    {
        var order = _service.PlaceOrder(customerId, items);
        return (201, order.CustomerId);
    }

    // [violation]
    // Anti-pattern: reaching straight past Application and Domain into Data access.
    // Nothing in a plain class stops this — only discipline and code review do.
    public List<object> HandleDebugLookup(string id)
    {
        return Db.DatabaseQuery($"SELECT * FROM orders WHERE id = '{id}'");
    }
    // [/violation]
}
// [/controller]

static class Db
{
    public static List<object> DatabaseQuery(string sql)
    {
        Console.WriteLine($"SQL: {sql}");
        return new List<object>();
    }
}
