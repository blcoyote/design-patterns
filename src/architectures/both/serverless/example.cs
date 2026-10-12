using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
var services = new Services(new OrderStore(), new MessageQueues());
var platform = new Platform(services);
platform.Register(CreateOrder.Definition);
platform.Register(SendReceipt.Definition);
platform.Register(DailyReport.Definition);

void Post(string customerId, long totalCents)
{
    var response = platform.Http("POST", "/orders", new OrderRequest(customerId, totalCents));
    Console.WriteLine($"POST /orders -> {response.Status} {response.Body}");
}

// The first request cold-starts createOrder, the next two reuse its warm instance.
Post("cust-42", 6997);
Post("cust-7", 2999);
Post("cust-9", 0);

// Nothing has run sendReceipt yet: the platform does that when it drains the queue.
platform.DrainQueues();

// Idle time passes: every instance is dropped, and the call counter with it.
platform.ReclaimIdle();
Post("cust-42", 1500);

// order-3 is still queued, so the report counts it but sees only two receipted orders.
platform.Tick("daily-report");
Console.WriteLine(
    $"cold starts: createOrder {platform.ColdStarts("createOrder")}, sendReceipt {platform.ColdStarts("sendReceipt")}, dailyReport {platform.ColdStarts("dailyReport")}");
// [/usage]

// [events]
/// <summary>
/// What a function is given and what it may return. A function never sees the platform: it
/// receives one trigger event plus the managed services, and that is all. The events form a
/// closed set of records, one member per way a function can be triggered.
/// </summary>
abstract record TriggerEvent
{
    /// The name of the event's kind, for error messages.
    public abstract string Kind { get; }
}

/// The body of a request from outside. Money is integer cents everywhere.
sealed record OrderRequest(string CustomerId, long TotalCents);

/// A message waiting in the order-placed queue.
sealed record OrderPlacedMessage(string OrderId);

/// A request from outside.
sealed record HttpEvent(string Method, string Path, OrderRequest Body) : TriggerEvent
{
    public override string Kind => "http";
}

/// A message the platform took from a queue and hands to the function subscribed to it.
sealed record QueueEvent(string Queue, OrderPlacedMessage Message) : TriggerEvent
{
    public override string Kind => "queue";
}

/// A schedule firing. It carries no data: the function reads whatever it needs from the services.
sealed record ScheduleEvent(string Schedule) : TriggerEvent
{
    public override string Kind => "schedule";
}

sealed record HttpResponse(int Status, string Body);

/// <summary>
/// The function contract. Only an http function has a caller waiting for an answer, so the
/// others return null. One instance is created per cold start and handles invocations
/// one after another.
/// </summary>
interface IFunctionInstance
{
    HttpResponse? Handle(TriggerEvent triggerEvent, Services services);
}

/// What makes the platform run a function.
abstract record Trigger;

sealed record HttpTrigger(string Route) : Trigger;

sealed record QueueTrigger(string Queue) : Trigger;

sealed record ScheduleTrigger(string Schedule) : Trigger;

/// A deployed function: its name, what triggers it, and how to build a fresh instance of it.
sealed record FunctionDefinition(string Name, Trigger Trigger, Func<IFunctionInstance> Create);

/// Formats 6997 as "69.97" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator).
static class Money
{
    public static string FormatCents(long cents)
    {
        long absolute = Math.Abs(cents);
        long whole = absolute / 100;
        long fraction = absolute % 100;
        string sign = cents < 0 ? "-" : "";
        return $"{sign}{whole.ToString(CultureInfo.InvariantCulture)}.{fraction.ToString("D2", CultureInfo.InvariantCulture)}";
    }
}
// [/events]

// [services]
enum OrderStatus
{
    Received,
    Receipted,
}

/// One row in the orders table.
sealed record Order(string Id, string CustomerId, long TotalCents, OrderStatus Status);

/// <summary>
/// A managed table that outlives every function instance. Real systems use a hosted database
/// (DynamoDB, Cosmos DB, Firestore); here it is a Dictionary in memory. The id counter lives in the
/// store too, so ids stay unique no matter how many instances come and go.
/// </summary>
sealed class OrderStore
{
    // A Dictionary does not promise an enumeration order, so the ids are kept in a List in
    // insertion order. Saving an existing id replaces the row and keeps its place.
    private readonly List<string> _ids = new();
    private readonly Dictionary<string, Order> _rows = new();
    private int _lastId = 0;

    public string NextOrderId()
    {
        _lastId++;
        return $"order-{_lastId.ToString(CultureInfo.InvariantCulture)}";
    }

    /// Inserts the order, or replaces the row with the same id.
    public void Save(Order order)
    {
        if (!_rows.ContainsKey(order.Id)) _ids.Add(order.Id);
        _rows[order.Id] = order;
    }

    public Order? Get(string id) => _rows.TryGetValue(id, out var order) ? order : null;

    /// Every order, oldest first.
    public List<Order> All() => _ids.Select(id => _rows[id]).ToList();
}

/// <summary>
/// Managed named queues, first in first out (like SQS, Service Bus or Pub/Sub). A message
/// waits here until the platform takes it and hands it to the subscribed function.
/// </summary>
sealed class MessageQueues
{
    private readonly Dictionary<string, Queue<OrderPlacedMessage>> _queues = new();

    public void Enqueue(string queue, OrderPlacedMessage message)
    {
        if (!_queues.TryGetValue(queue, out var waiting))
        {
            waiting = new Queue<OrderPlacedMessage>();
            _queues[queue] = waiting;
        }
        waiting.Enqueue(message);
    }

    /// Removes and returns the oldest message, or null when the queue is empty.
    public OrderPlacedMessage? Take(string queue) =>
        _queues.TryGetValue(queue, out var waiting) && waiting.TryDequeue(out var message) ? message : null;
}

/// Handed to every invocation. Functions keep nothing that must last anywhere else.
sealed record Services(OrderStore Orders, MessageQueues Queues);
// [/services]

// [platform]
/// <summary>
/// The managed runtime. It decides when functions are created, reused, triggered and
/// discarded. AWS Lambda, Azure Functions and Google Cloud Functions make all of these
/// decisions themselves and run many instances of one function side by side; this class only
/// makes it visible. It keeps at most one warm instance per function because the invocations
/// here run one after another, and there are no timers or clock: ReclaimIdle stands for idle
/// time passing and Tick stands for a schedule firing.
/// </summary>
sealed class Platform
{
    private sealed class DeployedFunction
    {
        public DeployedFunction(FunctionDefinition def)
        {
            Def = def;
        }

        public FunctionDefinition Def { get; }

        /// At most one warm instance per function.
        public IFunctionInstance? Warm { get; set; }

        public int ColdStartCount { get; set; }
    }

    /// Functions in registration order: that order is the order queues are drained in.
    private readonly List<DeployedFunction> _functions = new();

    private readonly Services _services;

    public Platform(Services services)
    {
        _services = services;
    }

    public void Register(FunctionDefinition def)
    {
        _functions.Add(new DeployedFunction(def));
    }

    /// Routes a request to the function whose http trigger has the route "<method> <path>".
    public HttpResponse Http(string method, string path, OrderRequest body)
    {
        var route = $"{method} {path}";
        var target = _functions.FirstOrDefault(
            candidate => candidate.Def.Trigger is HttpTrigger http && http.Route == route);
        // A request nobody listens for is a programmer bug, not something to answer with a 404.
        if (target == null) throw new InvalidOperationException($"no function for {route}");
        var response = Invoke(target.Def, new HttpEvent(method, path, body));
        if (response == null) throw new InvalidOperationException($"{target.Def.Name} returned no response");
        return response;
    }

    /// <summary>
    /// For each queue-triggered function in registration order, keeps taking the next message
    /// from its queue and invoking the function until that queue is empty.
    /// </summary>
    public void DrainQueues()
    {
        foreach (var deployed in _functions)
        {
            if (deployed.Def.Trigger is not QueueTrigger trigger) continue;
            for (var message = _services.Queues.Take(trigger.Queue);
                 message != null;
                 message = _services.Queues.Take(trigger.Queue))
            {
                Invoke(deployed.Def, new QueueEvent(trigger.Queue, message));
            }
        }
    }

    /// A schedule fires: invokes the function subscribed to it.
    public void Tick(string schedule)
    {
        var target = _functions.FirstOrDefault(
            candidate => candidate.Def.Trigger is ScheduleTrigger scheduled && scheduled.Schedule == schedule);
        if (target == null) throw new InvalidOperationException($"no function for schedule {schedule}");
        Invoke(target.Def, new ScheduleEvent(schedule));
    }

    /// Scale to zero: drops every warm instance, and with it everything that was only in memory.
    public void ReclaimIdle()
    {
        int reclaimed = 0;
        foreach (var deployed in _functions)
        {
            if (deployed.Warm != null) reclaimed++;
            deployed.Warm = null;
        }
        Console.WriteLine($"[platform] idle instances reclaimed: {reclaimed}");
    }

    public int ColdStarts(string name) => DeployedOf(name).ColdStartCount;

    private HttpResponse? Invoke(FunctionDefinition def, TriggerEvent triggerEvent)
    {
        var deployed = DeployedOf(def.Name);
        var instance = deployed.Warm;
        if (instance == null)
        {
            Console.WriteLine($"[platform] {def.Name}: cold start");
            instance = def.Create();
            deployed.ColdStartCount++;
            deployed.Warm = instance; // stays warm after this invocation, until ReclaimIdle
        }
        else
        {
            Console.WriteLine($"[platform] {def.Name}: warm");
        }
        return instance.Handle(triggerEvent, _services);
    }

    private DeployedFunction DeployedOf(string name)
    {
        var deployed = _functions.FirstOrDefault(candidate => candidate.Def.Name == name);
        if (deployed == null) throw new InvalidOperationException($"unknown function {name}");
        return deployed;
    }
}
// [/platform]

// [createOrder]
sealed class CreateOrderInstance : IFunctionInstance
{
    // Instance memory: it survives from one invocation to the next only while the platform
    // keeps this instance warm, and starts at zero again after every cold start. This is
    // exactly the kind of state you must not rely on. The order ids come from the store.
    private int _calls = 0;

    public HttpResponse? Handle(TriggerEvent triggerEvent, Services services)
    {
        if (triggerEvent is not HttpEvent http)
        {
            throw new InvalidOperationException($"createOrder expects an http event, got {triggerEvent.Kind}");
        }
        _calls++;

        var (customerId, totalCents) = http.Body;
        if (totalCents <= 0)
        {
            return new HttpResponse(400, $"total must be positive (instance call {_calls})");
        }

        // Two separate writes: save the order, then enqueue the message. If this instance dies
        // between them, the order exists and nobody is ever told. A real system would close that
        // gap with an outbox or the platform's transactional outputs; this example has neither.
        var id = services.Orders.NextOrderId();
        services.Orders.Save(new Order(id, customerId, totalCents, OrderStatus.Received));
        services.Queues.Enqueue("order-placed", new OrderPlacedMessage(id));
        return new HttpResponse(201, $"{id} received (instance call {_calls})");
    }
}

static class CreateOrder
{
    public static readonly FunctionDefinition Definition = new(
        "createOrder",
        new HttpTrigger("POST /orders"),
        () => new CreateOrderInstance());
}
// [/createOrder]

// [sendReceipt]
/// Runs once per order-placed message: reads the order from the store and marks it receipted.
sealed class SendReceiptInstance : IFunctionInstance
{
    public HttpResponse? Handle(TriggerEvent triggerEvent, Services services)
    {
        if (triggerEvent is not QueueEvent queue)
        {
            throw new InvalidOperationException($"sendReceipt expects a queue event, got {triggerEvent.Kind}");
        }

        var order = services.Orders.Get(queue.Message.OrderId);
        if (order == null) throw new InvalidOperationException($"unknown order {queue.Message.OrderId}");
        Console.WriteLine($"[email] receipt for {order.Id} to {order.CustomerId}: {Money.FormatCents(order.TotalCents)}");
        services.Orders.Save(order with { Status = OrderStatus.Receipted });
        return null;
    }
}

static class SendReceipt
{
    public static readonly FunctionDefinition Definition = new(
        "sendReceipt",
        new QueueTrigger("order-placed"),
        () => new SendReceiptInstance());
}
// [/sendReceipt]

// [dailyReport]
/// Runs when the schedule fires. It only reads: whatever it reports comes from the store.
sealed class DailyReportInstance : IFunctionInstance
{
    public HttpResponse? Handle(TriggerEvent triggerEvent, Services services)
    {
        if (triggerEvent is not ScheduleEvent)
        {
            throw new InvalidOperationException($"dailyReport expects a schedule event, got {triggerEvent.Kind}");
        }

        var orders = services.Orders.All();
        long totalCents = orders.Sum(order => order.TotalCents);
        int receipted = orders.Count(order => order.Status == OrderStatus.Receipted);
        Console.WriteLine($"[report] {orders.Count} orders, total {Money.FormatCents(totalCents)}, {receipted} receipted");
        return null;
    }
}

static class DailyReport
{
    public static readonly FunctionDefinition Definition = new(
        "dailyReport",
        new ScheduleTrigger("daily-report"),
        () => new DailyReportInstance());
}
// [/dailyReport]
