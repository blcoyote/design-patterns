using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Diagnostics;
using System.Globalization;
using System.Linq;

// Usage
var store = OrderStores.InMemory();
var handlePlaceOrder = Handlers.MakePlaceOrderHandler(new PlaceOrderDeps(
    Load: store.Load,
    Save: store.Save,
    Publish: Shipping.RequestShipment,
    Policy: OrderRules.RequireAtLeastOneLine));

var draft = Orders.CreateDraft("order-1", "cust-42");
store.Save(draft);

var placeResult = handlePlaceOrder(new PlaceOrderCommand("order-1",
[
    new UnvalidatedLine("WIDGET", 19.99m, 2),
    new UnvalidatedLine("GADGET", 29.99m, 1),
]));
switch (placeResult)
{
    case Ok<PlacedOrder>(var placed):
        Console.WriteLine($"order {placed.Id} placed, total: {MoneyOps.Format(placed.Total)}");
        break;
    case Err<PlacedOrder>(var error):
        Console.WriteLine($"rejected: {error}");
        break;
}

// Nothing was mutated: the local draft is still the empty draft it was.
Console.WriteLine($"original draft untouched: {draft.Kind}, {draft.Lines.Count} lines");

// The invariant in action: a placed order refuses to grow, and says so with an Err value.
if (store.Load("order-1") is not { } stored)
    throw new InvalidOperationException("order-1 should be in the store");
var lateResult = OrderLines.Create("LATE-ITEM", MoneyOps.Create(5), 1)
    .Bind(line => OrderRules.AddLine(stored, line));
if (lateResult is Err<DraftOrder>(var lateError)) Console.WriteLine($"rejected: {lateError}");

// A smart constructor refuses an invalid line, also as a value.
var brokenLine = OrderLines.Create("BROKEN", MoneyOps.Create(1), 0);
if (brokenLine is Err<OrderLine>(var brokenError)) Console.WriteLine($"rejected: {brokenError}");

// [result]
// Errors are values. A step that can fail returns a Result instead of throwing, so the
// possibility of failure is visible in the type and the caller has to deal with it.
// The cases are sealed records under an abstract record; callers tell them apart with
// pattern matching. (C# cannot check that such a match covers every case, so the
// switches below end in a discard arm for the case that cannot happen.)
abstract record Result<T>;
sealed record Ok<T>(T Value) : Result<T>;
sealed record Err<T>(string Error) : Result<T>;

static class Result
{
    public static Result<T> Ok<T>(T value) => new Ok<T>(value);

    public static Result<T> Err<T>(string error) => new Err<T>(error);

    // Bind is the railway switch: on Ok it runs the next step with the value, on Err it
    // skips the step and passes the same error along. Chaining binds is "railway-oriented
    // programming" — the first Err short-circuits everything after it.
    public static Result<U> Bind<T, U>(this Result<T> result, Func<T, Result<U>> next) =>
        result switch
        {
            Ok<T>(var value) => next(value),
            Err<T>(var error) => new Err<U>(error),
            _ => throw new UnreachableException(),
        };
}
// [/result]

// [money]
// Value object as plain data: no behaviour on the record, no hidden state. Equal fields
// mean equal money (records compare their fields by value).
sealed record Money(long Cents, string Currency);

static class MoneyOps
{
    // Rounds half away from zero, the same way as the OO version's Money.Of
    // (MidpointRounding.AwayFromZero, not the default banker's rounding).
    public static Money Create(decimal amount, string currency = "USD") =>
        new(Convert.ToInt64(Math.Round(amount * 100, MidpointRounding.AwayFromZero)), currency);

    public static Money Add(Money a, Money b)
    {
        // Adding two currencies is a programmer bug, not a domain outcome: no business
        // process "fails" this way, so it is thrown (Wlaschin: errors you model vs. panics).
        if (a.Currency != b.Currency) throw new InvalidOperationException("currency mismatch");
        return new Money(a.Cents + b.Cents, a.Currency);
    }

    public static string Format(Money m) =>
        $"{(m.Cents / 100m).ToString("F2", CultureInfo.InvariantCulture)} {m.Currency}";
}
// [/money]

// [orderLine]
// Value object as plain data. A record's constructor is public in C#, so "only through
// OrderLines.Create" is a convention here, not something the compiler enforces.
sealed record OrderLine(string Sku, Money UnitPrice, int Quantity);

static class OrderLines
{
    // Smart constructor: the one place a line is meant to be built. As long as code goes
    // through it, an invalid line never reaches the rest of the model. The failure comes
    // back as a value, not an exception.
    public static Result<OrderLine> Create(string sku, Money unitPrice, int quantity)
    {
        if (quantity < 1) return Result.Err<OrderLine>($"invalid line {sku}: quantity must be at least 1");
        return Result.Ok(new OrderLine(sku, unitPrice, quantity));
    }

    public static Money LineTotal(OrderLine line)
    {
        var total = MoneyOps.Create(0, line.UnitPrice.Currency);
        for (var i = 0; i < line.Quantity; i++) total = MoneyOps.Add(total, line.UnitPrice);
        return total;
    }
}
// [/orderLine]

// [order]
// Type-state: an order is either a draft or placed, and the two are different types.
// Only a PlacedOrder has a total, so "total of a draft" cannot even be written.
// Records are immutable (init-only properties) and ImmutableList cannot be changed in
// place: a transition builds a new value and leaves the old one alone.
abstract record Order(string Id, string CustomerId, ImmutableList<OrderLine> Lines)
{
    // A readable tag for the case, like the "kind" field of the TypeScript union.
    public abstract string Kind { get; }
}

sealed record DraftOrder(string Id, string CustomerId, ImmutableList<OrderLine> Lines)
    : Order(Id, CustomerId, Lines)
{
    public override string Kind => "draft";
}

sealed record PlacedOrder(string Id, string CustomerId, ImmutableList<OrderLine> Lines, Money Total)
    : Order(Id, CustomerId, Lines)
{
    public override string Kind => "placed";
}

static class Orders
{
    // Factory function: an order always starts as an empty draft.
    public static DraftOrder CreateDraft(string id, string customerId) =>
        new(id, customerId, ImmutableList<OrderLine>.Empty);
}
// [/order]

// [orderPlaced]
// Domain event as plain data. It carries no timestamp: the imperative shell would
// stamp the time, which keeps the core pure (no clock reads).
abstract record OrderEvent;
sealed record OrderPlaced(string OrderId, string CustomerId, Money Total) : OrderEvent;
// [/orderPlaced]

// [rules]
// Business rules as pure functions: each takes values and returns new values. None of
// them mutates its input or performs I/O.
sealed record PlaceOrderOutcome(PlacedOrder Order, ImmutableList<OrderEvent> Events);

static class OrderRules
{
    // Strategy as a function type: a policy is just a Func from a draft to a Result.
    // (Func<DraftOrder, Result<DraftOrder>>; this method is passed as a method group.)
    public static Result<DraftOrder> RequireAtLeastOneLine(DraftOrder order) =>
        order.Lines.Count > 0
            ? Result.Ok(order)
            : Result.Err<DraftOrder>($"cannot place order {order.Id}: an order needs at least one line to be placed");

    public static Result<DraftOrder> AddLine(Order order, OrderLine line) =>
        order switch
        {
            // A new draft: the old lines are copied into a new immutable list, never added to.
            DraftOrder draft => Result.Ok(draft with { Lines = draft.Lines.Add(line) }),
            // The invariant: a placed order cannot grow. It comes back as an Err value.
            PlacedOrder placed => Result.Err<DraftOrder>($"cannot add a line to order {placed.Id}: already placed"),
            _ => throw new UnreachableException(),
        };

    public static Result<PlaceOrderOutcome> Place(Order order, Func<DraftOrder, Result<DraftOrder>> policy) =>
        order switch
        {
            PlacedOrder placed => Result.Err<PlaceOrderOutcome>($"order {placed.Id} is already placed"),
            DraftOrder draft => policy(draft).Bind(accepted =>
            {
                // Fold the line totals into one Money.
                var total = accepted.Lines.Aggregate(
                    MoneyOps.Create(0),
                    (sum, line) => MoneyOps.Add(sum, OrderLines.LineTotal(line)));
                var placedOrder = new PlacedOrder(accepted.Id, accepted.CustomerId, accepted.Lines, total);
                // The event is returned alongside the new order. Nothing is stored or published here.
                var placedEvent = new OrderPlaced(placedOrder.Id, placedOrder.CustomerId, placedOrder.Total);
                return Result.Ok(new PlaceOrderOutcome(placedOrder, ImmutableList.Create<OrderEvent>(placedEvent)));
            }),
            _ => throw new UnreachableException(),
        };
}
// [/rules]

// [workflow]
// The input as it arrives from outside: raw, unvalidated numbers and strings.
sealed record UnvalidatedLine(string Sku, decimal Price, int Quantity);

sealed record PlaceOrderCommand(string OrderId, IReadOnlyList<UnvalidatedLine> Lines);

static class Workflows
{
    // The use case as one pure function: (order, command, policy) in, Result out. It
    // validates each raw line (OrderLines.Create), adds it (OrderRules.AddLine), then
    // places the order. Each step is chained with Bind, so the first Err skips every later step.
    // No I/O: loading the order and storing the result are the handler's job.
    public static Result<PlaceOrderOutcome> PlaceOrderWorkflow(
        Order order,
        PlaceOrderCommand cmd,
        Func<DraftOrder, Result<DraftOrder>> policy)
    {
        var withLines = cmd.Lines.Aggregate(
            Result.Ok<Order>(order),
            (acc, raw) => acc.Bind(current =>
                OrderLines.Create(raw.Sku, MoneyOps.Create(raw.Price), raw.Quantity)
                    .Bind(line => OrderRules.AddLine(current, line))
                    // C# generic types are invariant, so Result<DraftOrder> is widened
                    // to Result<Order> explicitly (the TypeScript Result is covariant).
                    .Bind(added => Result.Ok<Order>(added))));
        return withLines.Bind(current => OrderRules.Place(current, policy));
    }
}
// [/workflow]

// [orderStore]
// Repository as a record of functions instead of an interface with a class behind it.
// Load is a Func<string, Order?> and Save an Action<Order>.
sealed record OrderStore(Func<string, Order?> Load, Action<Order> Save);

static class OrderStores
{
    // The in-memory adapter: the two functions close over a Dictionary. Saving replaces
    // whatever was stored under that id.
    public static OrderStore InMemory()
    {
        var orders = new Dictionary<string, Order>();
        return new OrderStore(
            Load: id => orders.GetValueOrDefault(id),
            Save: order => { orders[order.Id] = order; });
    }
}
// [/orderStore]

// [shipping]
// Shipping bounded context: its own vocabulary. It has never heard of an "Order" or
// of OrderPlaced.
sealed record ShipmentRequested(string ShipmentId, string RecipientId, Money Value);

static class Shipping
{
    // A side effect, so it lives in the shell, not in the pure core.
    public static void RequestShipment(ShipmentRequested requested) =>
        Console.WriteLine($"[shipping] shipment {requested.ShipmentId} requested for {requested.RecipientId}, value {MoneyOps.Format(requested.Value)}");
}
// [/shipping]

// [acl]
static class Acl
{
    // Anti-Corruption Layer as a pure function: translates Ordering's OrderPlaced into
    // Shipping's own ShipmentRequested, so Ordering's model never leaks into Shipping.
    // It only builds a new value; delivering it is the handler's job.
    public static ShipmentRequested ToShipmentRequested(OrderPlaced placed) =>
        new($"ship-{placed.OrderId}", placed.CustomerId, placed.Total);
}
// [/acl]

// [handler]
// Dependencies are plain functions. They are handed over once, when the handler is built.
sealed record PlaceOrderDeps(
    Func<string, Order?> Load,
    Action<Order> Save,
    Action<ShipmentRequested> Publish,
    Func<DraftOrder, Result<DraftOrder>> Policy);

static class Handlers
{
    // The imperative shell: I/O at the edges, the pure workflow in the middle. The
    // dependencies reach it through a closure (partial application), not a constructor.
    // Order: load (I/O), run the pure workflow, on Ok save (I/O), then publish each event.
    public static Func<PlaceOrderCommand, Result<PlacedOrder>> MakePlaceOrderHandler(PlaceOrderDeps deps) =>
        cmd =>
        {
            if (deps.Load(cmd.OrderId) is not { } existing)
                return Result.Err<PlacedOrder>($"no such order: {cmd.OrderId}");

            switch (Workflows.PlaceOrderWorkflow(existing, cmd, deps.Policy))
            {
                case Ok<PlaceOrderOutcome>(var outcome):
                    deps.Save(outcome.Order);
                    foreach (var e in outcome.Events)
                    {
                        switch (e)
                        {
                            case OrderPlaced placed:
                                deps.Publish(Acl.ToShipmentRequested(placed));
                                break;
                        }
                    }
                    return Result.Ok(outcome.Order);
                case Err<PlaceOrderOutcome>(var error):
                    return Result.Err<PlacedOrder>(error);
                default:
                    throw new UnreachableException();
            }
        };
}
// [/handler]
