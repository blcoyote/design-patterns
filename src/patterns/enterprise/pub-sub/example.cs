// In production C# you'd often reach for a library instead of hand-rolling
// this: MediatR notifications in-process, or MassTransit / a message broker
// across processes. We keep the explicit pattern structure here for clarity
// (no NuGet dependency).

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

// One entry per Subscribe() call. A class (not a record), so List.Remove
// compares by reference and finds exactly this subscription.
sealed class Subscription(Delegate handler)
{
    public Delegate Handler { get; } = handler;
}

// [eventBus]
class EventBus
{
    // A list of subscriptions per topic, kept in subscription order.
    private readonly Dictionary<string, List<Subscription>> _topics = new();

    // [subscribe]
    public Action Subscribe<T>(string topic, Action<T> handler)
    {
        if (!_topics.TryGetValue(topic, out var subscriptions))
        {
            subscriptions = new List<Subscription>();
            _topics[topic] = subscriptions;
        }
        // Each call gets its own subscription, so subscribing the same handler
        // twice delivers twice, and each unsubscribe removes only its own entry.
        var subscription = new Subscription(handler);
        subscriptions.Add(subscription);
        return () => subscriptions.Remove(subscription);
    }
    // [/subscribe]

    public void Publish<T>(string topic, T payload)
    {
        // [dispatch]
        // Loop over a snapshot so a handler that subscribes or unsubscribes
        // mid-publish doesn't affect the round we're already delivering.
        if (_topics.TryGetValue(topic, out var subscriptions))
        {
            foreach (var subscription in subscriptions.ToArray()) ((Action<T>)subscription.Handler)(payload);
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
        bus.Subscribe<OrderPlaced>("order.placed", e =>
            Track("order.placed", FormattableString.Invariant($"orderId={e.OrderId} total={e.Total}")));
        bus.Subscribe<UserSignedUp>("user.signedUp", e => Track("user.signedUp", $"userId={e.UserId} email={e.Email}"));
    }
    private void Track(string topic, string details) => Console.WriteLine($"analytics: {topic} {details}");
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
