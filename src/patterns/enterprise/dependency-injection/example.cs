// In production C# you'd normally reach for Microsoft.Extensions.DependencyInjection
// (IServiceCollection/IServiceProvider) instead of hand-rolling a container, but we
// keep the explicit pattern structure here for clarity.

// [usage]
// This block — the only place that touches Container directly — is the real
// composition root: it configures the graph once, then hands off to plain
// objects that never see the container again.
var container = new Container();

container.Register("config", Array.Empty<string>(), _ => new Config());
container.Register("orderRepository", new[] { "config" }, deps => new SqlOrderRepository((Config)deps[0]));
container.Register("emailSender", Array.Empty<string>(), _ => new SmtpEmailSender());
container.Register("orderService", new[] { "orderRepository", "emailSender" }, deps => new OrderService((IOrderRepository)deps[0], (IEmailSender)deps[1]));
container.Register("orderController", new[] { "orderService" }, deps => new OrderController((OrderService)deps[0]));

// Ask only for the root — the container works out the rest of the graph.
// Note: OrderController and OrderService never call container.Resolve()
// themselves — if they did, that would be the Service Locator pattern, not DI.
var orderController = container.Resolve<OrderController>("orderController");
orderController.Handle("A-1001", "ada@example.com");
// [/usage]

OrderServiceTest.Run();

// [emailSender]
interface IEmailSender
{
    void Send(string to, string subject, string body);
}
// [/emailSender]

// [smtpEmailSender]
class SmtpEmailSender : IEmailSender
{
    public void Send(string to, string subject, string body)
    {
        Console.WriteLine($"SMTP -> {to}: {subject}");
    }
}
// [/smtpEmailSender]

// [config]
class Config(string dbUrl = "postgres://localhost/orders")
{
    public string DbUrl { get; } = dbUrl;
}
// [/config]

// [orderRepository]
interface IOrderRepository
{
    void Save(string orderId);
    object? FindById(string orderId);
}
// [/orderRepository]

// [sqlOrderRepository]
class SqlOrderRepository(Config config) : IOrderRepository
{
    public void Save(string orderId)
    {
        Console.WriteLine($"INSERT INTO orders ({config.DbUrl}) ...");
    }

    public object? FindById(string orderId)
    {
        Console.WriteLine($"SELECT * FROM orders ({config.DbUrl}) WHERE id = {orderId}");
        return null;
    }
}
// [/sqlOrderRepository]

// [orderService]
class OrderService(IOrderRepository repository, IEmailSender emailSender)
{
    public void PlaceOrder(string orderId, string customerEmail)
    {
        repository.Save(orderId);
        emailSender.Send(customerEmail, "Order placed", $"Order {orderId} is confirmed.");
    }
}
// [/orderService]

// [orderController]
class OrderController(OrderService service)
{
    public void Handle(string orderId, string customerEmail)
    {
        service.PlaceOrder(orderId, customerEmail);
    }
}
// [/orderController]

// [container]
// A container is nothing magical: a map of providers (each listing the keys it
// needs) plus a Resolve() that builds those dependencies first, recursively,
// and caches every result as a singleton. Real containers (Spring, ASP.NET
// Core's IServiceCollection, InversifyJS) also offer transient (new instance
// every resolve) and scoped (one instance per request/operation) lifetimes;
// this toy container only ever does singleton.
class Container
{
    private readonly Dictionary<string, (string[] Deps, Func<object[], object> Create)> _providers = new();
    private readonly Dictionary<string, object> _singletons = new();

    public void Register(string key, string[] deps, Func<object[], object> create)
    {
        _providers[key] = (deps, create);
    }

    public T Resolve<T>(string key)
    {
        if (!_singletons.TryGetValue(key, out var instance))
        {
            if (!_providers.TryGetValue(key, out var provider))
                throw new InvalidOperationException("No provider registered for " + key);
            // Build whatever it needs first (recursively), then construct it.
            var args = provider.Deps.Select(dep => Resolve<object>(dep)).ToArray();
            instance = provider.Create(args);
            _singletons[key] = instance;
        }
        return (T)instance;
    }
}
// [/container]

// [test]
// Tests don't need the container at all — just construct OrderService by hand
// with fakes for both of its dependencies:
static class OrderServiceTest
{
    public static void Run()
    {
        var fakeRepo = new FakeOrderRepository();
        var service = new OrderService(fakeRepo, new FakeEmailSender());
        service.PlaceOrder("A-1001", "ada@example.com");
    }
}

class FakeOrderRepository : IOrderRepository
{
    public List<string> Saved { get; } = new();
    public void Save(string orderId) => Saved.Add(orderId);
    public object? FindById(string orderId) => null;
}

class FakeEmailSender : IEmailSender
{
    public List<string> Sent { get; } = new();
    public void Send(string to, string subject, string body) => Sent.Add($"{to}: {subject}");
}
// [/test]
