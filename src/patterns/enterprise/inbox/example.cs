// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var db = new Database();
var broker = new MessageBroker();
new ShippingConsumer(db, broker);

db.FailNextCommit = true; // attempt 1 dies inside the transaction
broker.DropNextAck = true; // attempt 2 succeeds, but its ack is lost
broker.Publish(new OrderPlaced(1, "A1"));
// shipping: received message 1
// broker: message 1 failed (database connection lost), redelivering
// shipping: received message 1
// db: inbox #1 + shipment A1 saved
// broker: ack for message 1 lost, redelivering
// shipping: received message 1
// shipping: message 1 already in inbox, ignored
// broker: message 1 acked

Console.WriteLine($"shipments: {db.Shipments.Count}");
// shipments: 1
// [/client]

// A message as the broker delivers it. The Id is assigned by the producer
// (for example the outbox row id), so it is the same on every redelivery.
record OrderPlaced(int Id, string OrderId);

// [database]
// Thrown when an inbox id already exists, like a primary-key violation.
class DuplicateKeyException : Exception
{
    public DuplicateKeyException(string message) : base(message) { }
}

// An in-memory stand-in for ONE relational database that holds both the
// business table (shipments) and the inbox table (ids already processed).
class Transaction
{
    public List<int> InboxIds { get; } = new();
    public List<string> Shipments { get; } = new();

    public void InsertInbox(int id) => InboxIds.Add(id);
    public void InsertShipment(string orderId) => Shipments.Add(orderId);
}

class Database
{
    private readonly HashSet<int> inbox = new();
    public List<string> Shipments { get; } = new();
    // Fault injection for the demo: the next transaction fails before it
    // commits, as if the connection dropped mid-handler.
    public bool FailNextCommit;

    // [dbSeen]
    // A cheap pre-check. It is not the guard: two concurrent deliveries can both
    // pass it, so Transaction() enforces the unique inbox id at commit.
    public bool AlreadyProcessed(int id) => inbox.Contains(id);
    // [/dbSeen]

    // [transaction]
    // Stands in for BEGIN … COMMIT: the writes are staged and applied together
    // only if work() returns and the commit succeeds, so a failure leaves both
    // tables untouched. An inbox id that already exists violates the primary key
    // and rolls the whole transaction back, shipment included.
    public void Transaction(Action<Transaction> work)
    {
        var tx = new Transaction();
        work(tx);
        if (FailNextCommit)
        {
            FailNextCommit = false;
            throw new InvalidOperationException("database connection lost");
        }
        if (tx.InboxIds.Any(inbox.Contains)) throw new DuplicateKeyException("duplicate inbox id");
        foreach (var id in tx.InboxIds) inbox.Add(id);
        Shipments.AddRange(tx.Shipments);
        Console.WriteLine($"db: inbox #{tx.InboxIds[0]} + shipment {tx.Shipments[0]} saved");
    }
    // [/transaction]
}
// [/database]

// [messageBroker]
class MessageBroker
{
    private readonly List<Action<OrderPlaced>> handlers = new();
    // Fault injection for the demo: the next acknowledgement never arrives.
    public bool DropNextAck;

    public void Subscribe(Action<OrderPlaced> handler) => handlers.Add(handler);

    public void Publish(OrderPlaced message)
    {
        // [deliver]
        // At-least-once: keep delivering until a handler returns and its
        // acknowledgement arrives. A failure or a lost ack both mean "try again".
        while (true)
        {
            try
            {
                foreach (var handler in handlers.ToList()) handler(message);
            }
            catch (Exception e)
            {
                Console.WriteLine($"broker: message {message.Id} failed ({e.Message}), redelivering");
                continue;
            }
            if (DropNextAck)
            {
                DropNextAck = false;
                Console.WriteLine($"broker: ack for message {message.Id} lost, redelivering");
                continue;
            }
            Console.WriteLine($"broker: message {message.Id} acked");
            return;
        }
        // [/deliver]
    }
}
// [/messageBroker]

// [shippingConsumer]
class ShippingConsumer
{
    private readonly Database db;

    public ShippingConsumer(Database db, MessageBroker broker)
    {
        this.db = db;
        broker.Subscribe(OnOrderPlaced);
    }

    private void OnOrderPlaced(OrderPlaced message)
    {
        Console.WriteLine($"shipping: received message {message.Id}");
        // [inboxCheck]
        // Seen this id before? Then the work was already done: do nothing and
        // return normally, so the broker gets its ack and stops redelivering.
        if (db.AlreadyProcessed(message.Id))
        {
            Console.WriteLine($"shipping: message {message.Id} already in inbox, ignored");
            return;
        }
        // [/inboxCheck]
        // [inboxCommit]
        // The inbox row and the shipment are written in ONE transaction. A crash
        // can never leave "shipped but not recorded" or "recorded but not shipped".
        try
        {
            db.Transaction(tx =>
            {
                tx.InsertInbox(message.Id);
                tx.InsertShipment(message.OrderId);
            });
        }
        catch (DuplicateKeyException)
        {
            // Lost a race with a concurrent delivery of the same message: its
            // transaction won, ours rolled back, so this one is just a duplicate.
            Console.WriteLine($"shipping: message {message.Id} already in inbox, ignored");
        }
        // [/inboxCommit]
    }
}
// [/shippingConsumer]
