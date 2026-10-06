// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var db = new Database();
var broker = new MessageBroker();
var orders = new OrderService(db);
var relay = new OutboxRelay(db, broker);
new ShippingConsumer(broker);

orders.PlaceOrder("A1", 42);
// db: order A1 saved
// db: outbox #1 order.placed pending

db.FailNextMark = true; // the relay publishes #1, then loses its connection
relay.Poll();
// shipping: ship order A1 (message 1)
// relay: #1 failed (database connection lost), stays pending

relay.Poll(); // #1 is still pending, so it is published again
// shipping: message 1 already handled, ignored
// relay: #1 marked published

relay.Poll();
// relay: nothing pending
// [/client]

record OrderPlaced(string OrderId, int Total);

// One row of the outbox table. The Id is a counter, so it is stable across retries.
class OutboxMessage
{
    public required int Id { get; init; }
    public required string Topic { get; init; }
    public required OrderPlaced Payload { get; init; }
    public bool Published { get; set; }
}

// [database]
// An in-memory stand-in for ONE relational database that holds both the
// business table (orders) and the outbox table.
class Transaction
{
    public List<OrderPlaced> Orders { get; } = new();
    public List<(string Topic, OrderPlaced Payload)> Messages { get; } = new();

    public void InsertOrder(OrderPlaced order) => Orders.Add(order);
    public void InsertOutbox(string topic, OrderPlaced payload) => Messages.Add((topic, payload));
}

class Database
{
    private readonly List<OrderPlaced> _orders = new();
    private readonly List<OutboxMessage> _outbox = new();
    private int _nextMessageId = 1;

    // Fault injection for the demo: the next MarkPublished() fails, as if the
    // relay lost its database connection right after publishing.
    public bool FailNextMark { get; set; }

    // [transaction]
    // Stands in for BEGIN … COMMIT: the writes are staged and applied together
    // only if work() returns, so an exception leaves both tables untouched.
    public void RunTransaction(Action<Transaction> work)
    {
        var tx = new Transaction();
        work(tx);
        foreach (var order in tx.Orders)
        {
            _orders.Add(order);
            Console.WriteLine($"db: order {order.OrderId} saved");
        }
        foreach (var (topic, payload) in tx.Messages)
        {
            var row = new OutboxMessage { Id = _nextMessageId++, Topic = topic, Payload = payload };
            _outbox.Add(row);
            Console.WriteLine($"db: outbox #{row.Id} {row.Topic} pending");
        }
    }
    // [/transaction]

    // [dbPending]
    // Oldest first; ToList() builds a new list, so callers iterate a snapshot.
    public List<OutboxMessage> PendingMessages() => _outbox.Where(m => !m.Published).ToList();
    // [/dbPending]

    // [dbMark]
    public void MarkPublished(int id)
    {
        if (FailNextMark)
        {
            FailNextMark = false;
            throw new InvalidOperationException("database connection lost");
        }
        var row = _outbox.Find(m => m.Id == id);
        if (row is not null) row.Published = true;
    }
    // [/dbMark]
}
// [/database]

// [orderService]
class OrderService(Database db)
{
    public void PlaceOrder(string orderId, int total)
    {
        // [placeOrder]
        // No broker call here. The event goes into the outbox table in the same
        // transaction as the order, so either both are saved or neither is.
        db.RunTransaction(tx =>
        {
            tx.InsertOrder(new OrderPlaced(orderId, total));
            tx.InsertOutbox("order.placed", new OrderPlaced(orderId, total));
        });
        // [/placeOrder]
    }
}
// [/orderService]

// [messageBroker]
class MessageBroker
{
    private readonly Dictionary<string, List<Action<OutboxMessage>>> _handlers = new();

    public void Subscribe(string topic, Action<OutboxMessage> handler)
    {
        if (!_handlers.TryGetValue(topic, out var list))
        {
            list = new List<Action<OutboxMessage>>();
            _handlers[topic] = list;
        }
        list.Add(handler);
    }

    public void Publish(OutboxMessage message)
    {
        // [deliver]
        var handlers = _handlers.TryGetValue(message.Topic, out var list) ? list.ToList() : new List<Action<OutboxMessage>>();
        foreach (var handler in handlers)
        {
            handler(message);
        }
        // [/deliver]
    }
}
// [/messageBroker]

// [outboxRelay]
class OutboxRelay(Database db, MessageBroker broker)
{
    // Called on a schedule in real systems; the usage above calls it by hand.
    public void Poll()
    {
        // [relayPoll]
        var pending = db.PendingMessages();
        // [/relayPoll]
        if (pending.Count == 0)
        {
            Console.WriteLine("relay: nothing pending");
            return;
        }
        foreach (var message in pending)
        {
            try
            {
                // [relayPublish]
                broker.Publish(message);
                // [/relayPublish]
                // [relayMark]
                // A failure between publish and mark leaves the row pending, so the
                // next poll publishes it again: delivery is at-least-once.
                db.MarkPublished(message.Id);
                // [/relayMark]
                Console.WriteLine($"relay: #{message.Id} marked published");
            }
            catch (Exception e)
            {
                Console.WriteLine($"relay: #{message.Id} failed ({e.Message}), stays pending");
                break; // keep order: don't publish later messages ahead of this one
            }
        }
    }
}
// [/outboxRelay]

// [shippingConsumer]
class ShippingConsumer
{
    private readonly HashSet<int> _handled = new();

    public ShippingConsumer(MessageBroker broker)
    {
        broker.Subscribe("order.placed", OnOrderPlaced);
    }

    private void OnOrderPlaced(OutboxMessage message)
    {
        // [dedupe]
        // At-least-once delivery means the same message can arrive twice, so the
        // consumer remembers the ids it has already handled.
        if (!_handled.Add(message.Id))
        {
            Console.WriteLine($"shipping: message {message.Id} already handled, ignored");
            return;
        }
        // [/dedupe]
        Console.WriteLine($"shipping: ship order {message.Payload.OrderId} (message {message.Id})");
    }
}
// [/shippingConsumer]
