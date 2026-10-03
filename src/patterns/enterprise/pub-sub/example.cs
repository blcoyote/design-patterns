// In production C# you'd often reach for System.Threading.Channels or a
// broker library like MassTransit instead of hand-rolling this, but we keep
// the explicit pattern structure here for clarity (no NuGet dependency).

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
var bus = new EventBus();
var checkout = new CheckoutService(bus);
var users = new UserService(bus);
new EmailService(bus);
new AnalyticsService(bus);
var inventory = new InventoryService(bus);

checkout.PlaceOrder("A1", 42); // email, analytics and inventory all react
users.SignUp("U1", "ada@example.com"); // only email and analytics react

inventory.StopWatching();
checkout.PlaceOrder("A2", 15); // email and analytics react; inventory does not

record OrderPlaced(string OrderId, decimal Total);
record UserSignedUp(string UserId, string Email);

// [eventBus]
class EventBus
{
    private readonly Dictionary<string, List<Delegate>> _topics = new();

    // [subscribe]
    public Action Subscribe<T>(string topic, Action<T> handler)
    {
        if (!_topics.TryGetValue(topic, out var handlers))
        {
            handlers = new List<Delegate>();
            _topics[topic] = handlers;
        }
        handlers.Add(handler);
        return () => handlers.Remove(handler);
    }
    // [/subscribe]

    public void Publish<T>(string topic, T payload)
    {
        // [dispatch]
        if (_topics.TryGetValue(topic, out var handlers))
        {
            foreach (var handler in handlers.ToArray()) ((Action<T>)handler)(payload);
        }
        // [/dispatch]
    }
}
// [/eventBus]

// [checkoutService]
class CheckoutService(EventBus bus)
{
    public void PlaceOrder(string orderId, decimal total)
    {
        // ...charge the card, persist the order...
        // [checkoutPublish]
        bus.Publish("order.placed", new OrderPlaced(orderId, total));
        // [/checkoutPublish]
    }
}
// [/checkoutService]

// [userService]
class UserService(EventBus bus)
{
    public void SignUp(string userId, string email)
    {
        // ...create the account...
        // [userPublish]
        bus.Publish("user.signedUp", new UserSignedUp(userId, email));
        // [/userPublish]
    }
}
// [/userService]

// [emailService]
class EmailService
{
    public EmailService(EventBus bus)
    {
        bus.Subscribe<OrderPlaced>("order.placed", e => SendReceipt(e.OrderId));
        bus.Subscribe<UserSignedUp>("user.signedUp", e => SendWelcome(e.Email));
    }
    private void SendReceipt(string orderId) => Console.WriteLine($"email: receipt for order {orderId}");
    private void SendWelcome(string email) => Console.WriteLine($"email: welcome {email}");
}
// [/emailService]

// [analyticsService]
class AnalyticsService
{
    public AnalyticsService(EventBus bus)
    {
        bus.Subscribe<OrderPlaced>("order.placed", e => Track("order.placed", e));
        bus.Subscribe<UserSignedUp>("user.signedUp", e => Track("user.signedUp", e));
    }
    private void Track(string topic, object payload) => Console.WriteLine($"analytics: {topic} {payload}");
}
// [/analyticsService]

// [inventoryService]
class InventoryService
{
    private readonly Action _stopListening;

    public InventoryService(EventBus bus)
    {
        _stopListening = bus.Subscribe<OrderPlaced>("order.placed", e => Reserve(e.OrderId));
    }
    private void Reserve(string orderId) => Console.WriteLine($"inventory: reserved stock for {orderId}");

    // [unsubscribe]
    public void StopWatching()
    {
        _stopListening();
    }
    // [/unsubscribe]
}
// [/inventoryService]
