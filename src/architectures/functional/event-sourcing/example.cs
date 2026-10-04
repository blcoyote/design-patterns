using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// Usage
var store = new EventStore();
var projection = new WithdrawalCountProjection();
store.Subscribe((streamId, @event) => projection.Handle(streamId, @event));

const string streamId = "account-42";

// [handle]
// The command handler is the imperative shell around the pure core: load the stream,
// fold it, decide, then append at the version that was loaded. If another writer
// appended in between, the store sees a different length and rejects the append.
void Handle(Command command)
{
    var history = store.Load(streamId);
    var state = Fold(history);
    var events = Decide(command, state);
    store.Append(streamId, history.Count, events);
}
// [/handle]

// [decide]
// Decide(command, state) -> IReadOnlyList<Event>: the only place business rules live. It looks
// at the *current* state (rebuilt from history) and either returns the events that should
// happen, or throws to reject the command. It never mutates anything itself.
static IReadOnlyList<Event> Decide(Command command, Account state) => command switch
{
    OpenAccount c when state.Owner is not null => throw new InvalidOperationException("account already open"),
    OpenAccount c => new Event[] { new AccountOpened(c.Owner) },
    Deposit c => new Event[] { new Deposited(c.Amount) },
    Withdraw c when c.Amount > state.Balance => throw new InvalidOperationException("insufficient funds"),
    Withdraw c => new Event[] { new Withdrawn(c.Amount) },
    _ => throw new InvalidOperationException("unknown command"),
};
// [/decide]

// [fold]
// Replay: rebuild current state by folding every event in the stream over Evolve, starting
// from Account.Initial. This is the only way state ever comes into being — there is no
// separate "save the current balance" step.
static Account Fold(IEnumerable<Event> events) => events.Aggregate(Account.Initial, EventSourcing.Evolve);
// [/fold]

// [snapshot]
// Snapshot: a cached fold result at a known version, so replay does not have to start
// from event zero every time. Taking one never changes behavior, only replay cost.
static Account LoadWithSnapshot(EventStore store, string streamId, Snapshot? snapshot)
{
    var allEvents = store.Load(streamId);
    var newEvents = snapshot is not null ? allEvents.Skip(snapshot.Version) : allEvents;
    return newEvents.Aggregate(snapshot?.State ?? Account.Initial, EventSourcing.Evolve);
}
// [/snapshot]

Handle(new OpenAccount("Ada"));
Handle(new Deposit(100m));
Handle(new Withdraw(30m));

Console.WriteLine($"balance: {Fold(store.Load(streamId)).Balance.ToString(CultureInfo.InvariantCulture)}");
Console.WriteLine($"withdrawals so far: {projection.Count}");

// Snapshot avoids replaying from event zero on the next read.
var snapshot = new Snapshot(store.Load(streamId).Count, Fold(store.Load(streamId)));
Handle(new Deposit(50m));
var viaSnapshot = LoadWithSnapshot(store, streamId, snapshot);
Console.WriteLine($"balance via snapshot + newer events: {viaSnapshot.Balance.ToString(CultureInfo.InvariantCulture)}");

// Domain: a bank account, modeled the event-sourced way. Nothing here is a class with
// mutable fields — state is always *derived* from the events that happened to it.

abstract record Command;
record OpenAccount(string Owner) : Command;
record Deposit(decimal Amount) : Command;
record Withdraw(decimal Amount) : Command;

abstract record Event;
record AccountOpened(string Owner) : Event;
record Deposited(decimal Amount) : Event;
record Withdrawn(decimal Amount) : Event;

record Account(string? Owner, decimal Balance)
{
    public static readonly Account Initial = new(null, 0m);
}

static class EventSourcing
{
    // [evolve]
    // Evolve(state, event) -> state: a pure function that handles every Event declared in
    // this file. C# records can't declare a closed hierarchy, so the compiler still demands
    // the `_` arm; it is reachable only if someone adds a new Event subtype elsewhere.
    // It only ever applies an event that already happened — it never judges whether it should have.
    public static Account Evolve(Account state, Event @event) => @event switch
    {
        AccountOpened e => state with { Owner = e.Owner },
        Deposited e => state with { Balance = state.Balance + e.Amount },
        Withdrawn e => state with { Balance = state.Balance - e.Amount },
        _ => throw new InvalidOperationException("unknown event"),
    };
    // [/evolve]
}

// [append]
// EventStore: an append-only log, keyed by stream id. Append enforces optimistic
// concurrency — the caller must say which version it last read, and the append is
// rejected if the stream moved on in the meantime.
class EventStore
{
    // _appendGate serializes whole appends (check, write and notify): two appends at the
    // same expected version cannot both succeed, and subscribers see events in commit
    // order. _gate guards only the data, so a subscriber may still Load the stream.
    private readonly object _appendGate = new();
    private readonly object _gate = new();
    private readonly Dictionary<string, List<Event>> _streams = new();
    private readonly List<Action<string, Event>> _subscribers = new();

    // a copy, so callers cannot mutate the stored history behind Append()'s back
    public List<Event> Load(string streamId)
    {
        lock (_gate)
            return _streams.TryGetValue(streamId, out var events) ? new List<Event>(events) : new List<Event>();
    }

    public void Append(string streamId, int expectedVersion, IReadOnlyList<Event> events)
    {
        lock (_appendGate)
        {
            List<Action<string, Event>> subscribers;
            lock (_gate)
            {
                var existing = _streams.TryGetValue(streamId, out var stored) ? stored : new List<Event>();
                if (existing.Count != expectedVersion)
                    throw new InvalidOperationException($"concurrency conflict: expected version {expectedVersion}, found {existing.Count}");

                var updated = new List<Event>(existing);
                updated.AddRange(events);
                _streams[streamId] = updated;
                subscribers = new List<Action<string, Event>>(_subscribers);
            }

            // Still inside _appendGate, so no later append can notify first. A subscriber
            // may Load, but must never Append back to this store.
            foreach (var @event in events)
                foreach (var subscriber in subscribers)
                    subscriber(streamId, @event);
        }
    }

    public void Subscribe(Action<string, Event> fn)
    {
        lock (_gate) _subscribers.Add(fn);
    }
}
// [/append]

record Snapshot(int Version, Account State);

// [projection]
// Projection: a read model that subscribes to the stream and evolves its own shape —
// here, just a running count of withdrawals — independently of the write-side Account.
class WithdrawalCountProjection
{
    public int Count { get; private set; }

    public void Handle(string streamId, Event @event)
    {
        if (@event is Withdrawn) Count += 1;
    }
}
// [/projection]
