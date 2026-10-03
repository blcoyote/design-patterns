// [usage]
var broker = new EventBroker();
var email = new EmailConsumer();
var inventory = new InventoryConsumer(broker);
var analytics = new AnalyticsConsumer();

broker.Subscribe("OrderPlaced", e => email.OnOrderPlaced((OrderPlaced)e));
broker.Subscribe("OrderPlaced", Dedupe.Wrap(e => inventory.OnOrderPlaced((OrderPlaced)e)));
broker.Subscribe("OrderPlaced", e => analytics.OnOrderPlaced((OrderPlaced)e));

var producer = new OrdersProducer(broker);

var orderId = producer.PlaceOrder("WIDGET", 2);
broker.Drain();

// At-least-once redelivery: Inventory's dedupe pipeline recognizes order 1 and drops
// it; Email and Analytics have no such pipeline, so they process it again.
producer.Redeliver(orderId, "WIDGET", 2);
broker.Drain();

// Adding a consumer requires no change to OrdersProducer, EventBroker, or any other
// consumer — only a new Subscribe() call.
var loyalty = new LoyaltyConsumer();
broker.Subscribe("OrderPlaced", e => loyalty.OnOrderPlaced((OrderPlaced)e));

producer.PlaceOrder("GADGET", 1);
broker.Drain();
// [/usage]

// [events]
record OrderPlaced(int OrderId, string Item, int Quantity);

record StockReserved(int OrderId, string Item);
// [/events]

// [broker]
record QueuedMessage(string Topic, object Event);

/// <summary>
/// Broker: keeps a list of handlers per topic and an explicit, drainable queue.
/// Publishing only enqueues a message — it never calls a handler directly, and
/// draining is FIFO, so delivery order is deterministic and identical across languages.
/// </summary>
class EventBroker
{
    private readonly Dictionary<string, List<Action<object>>> subscribers = new();
    private readonly Queue<QueuedMessage> queue = new();

    public void Subscribe(string topic, Action<object> handler)
    {
        if (!subscribers.TryGetValue(topic, out var handlers))
        {
            handlers = new List<Action<object>>();
            subscribers[topic] = handlers;
        }
        handlers.Add(handler);
    }

    public void Publish(string topic, object @event)
    {
        // The publisher only knows a topic name, never a handler — adding or removing
        // a subscriber never requires touching this method or its caller.
        queue.Enqueue(new QueuedMessage(topic, @event));
    }

    // Drains the queue FIFO, including messages a handler enqueues while draining (choreography).
    public void Drain()
    {
        while (queue.Count > 0)
        {
            var message = queue.Dequeue();
            if (subscribers.TryGetValue(message.Topic, out var handlers))
            {
                foreach (var handler in handlers) handler(message.Event);
            }
        }
    }
}
// [/broker]

// [dedupe]
// Consumer-side handler pipeline (a tiny Chain of Responsibility): wraps a handler so a
// redelivered message with an orderId already seen is dropped before it reaches the
// real handler. This lives on the consumer, not the broker — the broker has no idea
// deduplication is happening.
static class Dedupe
{
    public static Action<object> Wrap(Action<object> handler)
    {
        var seen = new HashSet<int>();
        return @event =>
        {
            var orderPlaced = (OrderPlaced)@event;
            if (seen.Contains(orderPlaced.OrderId))
            {
                Console.WriteLine($"[inventory] duplicate OrderPlaced({orderPlaced.OrderId}) ignored");
                return;
            }
            seen.Add(orderPlaced.OrderId);
            handler(@event);
        };
    }
}
// [/dedupe]

// [email]
class EmailConsumer
{
    public void OnOrderPlaced(OrderPlaced @event)
    {
        Console.WriteLine($"[email] confirmation sent for order {@event.OrderId} ({@event.Quantity} x {@event.Item})");
    }
}
// [/email]

// [inventory]
class InventoryConsumer
{
    private readonly EventBroker broker;

    public InventoryConsumer(EventBroker broker)
    {
        this.broker = broker;
    }

    public void OnOrderPlaced(OrderPlaced @event)
    {
        Console.WriteLine($"[inventory] reserved {@event.Quantity} x {@event.Item} for order {@event.OrderId}");
        // Choreography: Inventory decides on its own to publish the next event — nothing
        // orchestrates this, and the broker itself has no idea what topic comes next.
        var stockReserved = new StockReserved(@event.OrderId, @event.Item);
        broker.Publish("StockReserved", stockReserved);
    }
}
// [/inventory]

// [analytics]
class AnalyticsConsumer
{
    private int count;

    public void OnOrderPlaced(OrderPlaced _)
    {
        count += 1;
        Console.WriteLine($"[analytics] order count: {count}");
    }
}
// [/analytics]

// [loyalty]
// Added after the system is already running, subscribing to the exact same topic.
// OrdersProducer below is never touched to make this consumer exist.
class LoyaltyConsumer
{
    public void OnOrderPlaced(OrderPlaced @event)
    {
        Console.WriteLine($"[loyalty] points awarded for order {@event.OrderId}");
    }
}
// [/loyalty]

// [producer]
class OrdersProducer
{
    private readonly EventBroker broker;
    private int nextOrderId = 1;

    public OrdersProducer(EventBroker broker)
    {
        this.broker = broker;
    }

    public int PlaceOrder(string item, int quantity)
    {
        var orderId = nextOrderId++;
        var @event = new OrderPlaced(orderId, item, quantity);
        // The producer depends on the broker and a topic name only — not on a single
        // consumer, and not on how many consumers (zero or a dozen) are listening.
        broker.Publish("OrderPlaced", @event);
        return orderId;
    }

    // Simulates an at-least-once broker redelivering a message it already delivered once.
    public void Redeliver(int orderId, string item, int quantity)
    {
        var @event = new OrderPlaced(orderId, item, quantity);
        broker.Publish("OrderPlaced", @event);
    }
}
// [/producer]
