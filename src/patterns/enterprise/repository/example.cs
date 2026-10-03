using System.Globalization;

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).

// [usage]
// Production: wired to the real database
var service = new OrderService(new SqlOrderRepository(new Database()));
Console.WriteLine(service.GetReceipt("482"));

// Tests: the exact same service, wired to an in-memory stand-in — no database involved
var fakeRepo = new InMemoryOrderRepository();
fakeRepo.Add(new Order("482", "cst-9", 42));
var testService = new OrderService(fakeRepo);
Console.WriteLine(testService.GetReceipt("482")); // reads straight out of the Dictionary, no SQL involved
// [/usage]

// [order]
record Order(string Id, string CustomerId, decimal Total);
// [/order]

// [orderRepository]
interface IOrderRepository
{
    Order? FindById(string id);
    IReadOnlyList<Order> FindByCustomer(string customerId);
    void Add(Order order);
    void Save(Order order); // persists changes to an already-added Order
    void Remove(string id);
}
// [/orderRepository]

// [database]
class Database
{
    public List<Dictionary<string, object>> Query(string sql, params object[] parameters)
    {
        // Print params the way the other languages do: strings quoted with '.
        var shown = parameters.Select(p => p is string str ? $"'{str}'" : Convert.ToString(p, CultureInfo.InvariantCulture));
        Console.WriteLine($"SQL: {sql} [{string.Join(", ", shown)}]");
        return new List<Dictionary<string, object>>
        {
            new() { ["id"] = "482", ["customer_id"] = "cst-9", ["total_cents"] = 4200 },
        };
    }
}
// [/database]

// [sqlOrderRepository]
class SqlOrderRepository(Database db) : IOrderRepository
{
    // [findById]
    public Order? FindById(string id)
    {
        var rows = db.Query("SELECT * FROM orders WHERE id = ?", id);
        return rows.Count > 0 ? MapRow(rows[0]) : null;
    }
    // [/findById]

    public IReadOnlyList<Order> FindByCustomer(string customerId)
    {
        var rows = db.Query("SELECT * FROM orders WHERE customer_id = ?", customerId);
        return rows.Select(MapRow).ToList();
    }

    public void Add(Order order)
    {
        db.Query(
            "INSERT INTO orders (id, customer_id, total_cents) VALUES (?, ?, ?)",
            order.Id,
            order.CustomerId,
            Math.Round(order.Total * 100, MidpointRounding.AwayFromZero));
    }

    public void Save(Order order)
    {
        // An update path for an Order already added — see the Unit of Work pattern
        // for batching several such changes into a single transaction.
        db.Query(
            "UPDATE orders SET customer_id = ?, total_cents = ? WHERE id = ?",
            order.CustomerId,
            Math.Round(order.Total * 100, MidpointRounding.AwayFromZero),
            order.Id);
    }

    public void Remove(string id)
    {
        db.Query("DELETE FROM orders WHERE id = ?", id);
    }

    // [mapRow]
    private static Order MapRow(Dictionary<string, object> row) =>
        new((string)row["id"], (string)row["customer_id"], (int)row["total_cents"] / 100m);
    // [/mapRow]
}
// [/sqlOrderRepository]

// [inMemoryOrderRepository]
class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<string, Order> _orders = new();

    public Order? FindById(string id) => _orders.GetValueOrDefault(id);

    public IReadOnlyList<Order> FindByCustomer(string customerId) =>
        _orders.Values.Where(order => order.CustomerId == customerId).ToList();

    public void Add(Order order) => _orders[order.Id] = order;

    public void Save(Order order) => _orders[order.Id] = order; // indexer already overwrites, so add and save coincide here

    public void Remove(string id) => _orders.Remove(id);
}
// [/inMemoryOrderRepository]

// [client]
class OrderService(IOrderRepository repo)
{
    public string GetReceipt(string orderId)
    {
        var order = repo.FindById(orderId);
        return order is not null ? $"Order {order.Id}: ${order.Total.ToString("F2", CultureInfo.InvariantCulture)}" : "not found";
    }
}
// [/client]
