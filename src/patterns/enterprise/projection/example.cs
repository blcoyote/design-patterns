// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var log = new EventLog();
var view = new CustomerSummaryView();
var projector = new Projector(log, view);

void Show(string customerId)
{
    var row = view.Get(customerId);
    Console.WriteLine(row is not null
        ? $"{customerId}: orders={row.Orders} spent={row.Spent}"
        : $"{customerId}: no row yet");
}

log.Append(new OrderEvent("OrderPlaced", "o1", "ada", 40));
// log: #1 OrderPlaced o1
log.Append(new OrderEvent("OrderPlaced", "o2", "grace", 25));
// log: #2 OrderPlaced o2
log.Append(new OrderEvent("OrderPlaced", "o3", "ada", 35));
// log: #3 OrderPlaced o3
Show("ada"); // the read model has not caught up yet
// ada: no row yet

projector.CatchUp();
// projector: applied 3 event(s) (checkpoint 3)
Show("ada");
// ada: orders=2 spent=75
Show("grace");
// grace: orders=1 spent=25

log.Append(new OrderEvent("OrderCancelled", "o1", "ada", 40));
// log: #4 OrderCancelled o1
projector.CatchUp();
// projector: applied 1 event(s) (checkpoint 4)
Show("ada");
// ada: orders=1 spent=35

view.Apply(log.ReadAfter(3)[0]); // the same event delivered a second time
// view: #4 already applied, ignored

projector.Rebuild();
// projector: view reset
// projector: applied 4 event(s) (checkpoint 4)
Show("ada");
// ada: orders=1 spent=35
Show("grace");
// grace: orders=1 spent=25
// [/client]

// One kind of fact per event. A real system would use one type per event; a
// single shape keeps this example short.
record OrderEvent(string Type, string OrderId, string CustomerId, int Total); // Type is "OrderPlaced" or "OrderCancelled"

record LoggedEvent(int Position, OrderEvent Event);

// [eventLog]
// The source of truth: an append-only log. Positions are counters, so they are
// stable and ordered.
class EventLog
{
    private readonly List<LoggedEvent> entries = new();

    // [logAppend]
    public int Append(OrderEvent evt)
    {
        var position = entries.Count + 1;
        entries.Add(new LoggedEvent(position, evt));
        Console.WriteLine($"log: #{position} {evt.Type} {evt.OrderId}");
        return position;
    }
    // [/logAppend]

    // [logRead]
    // ToList() builds a new list, so callers iterate a snapshot.
    public List<LoggedEvent> ReadAfter(int position) =>
        entries.Where(entry => entry.Position > position).ToList();
    // [/logRead]
}
// [/eventLog]

// [readModel]
record CustomerRow(int Orders, int Spent);

// A disposable read model shaped for one question: how much has each customer
// ordered? It can be deleted and rebuilt from the log at any time.
class CustomerSummaryView
{
    private readonly Dictionary<string, CustomerRow> rows = new();
    // The position of the last event applied. It is stored with the data it
    // describes (a real store updates both in one transaction).
    public int Checkpoint { get; private set; }

    // [viewApply]
    public void Apply(LoggedEvent logged)
    {
        // A position at or below the checkpoint was already applied, so a
        // redelivered event changes nothing.
        if (logged.Position <= Checkpoint)
        {
            Console.WriteLine($"view: #{logged.Position} already applied, ignored");
            return;
        }
        var evt = logged.Event;
        var row = rows.GetValueOrDefault(evt.CustomerId, new CustomerRow(0, 0));
        var sign = evt.Type == "OrderPlaced" ? 1 : -1;
        rows[evt.CustomerId] = new CustomerRow(row.Orders + sign, row.Spent + sign * evt.Total);
        Checkpoint = logged.Position;
    }
    // [/viewApply]

    // [viewGet]
    public CustomerRow? Get(string customerId) => rows.GetValueOrDefault(customerId);
    // [/viewGet]

    // [viewReset]
    public void Reset()
    {
        rows.Clear();
        Checkpoint = 0;
    }
    // [/viewReset]
}
// [/readModel]

// [projector]
// The only writer of the read model. It never decides anything: it replays what
// the log says happened.
class Projector(EventLog log, CustomerSummaryView view)
{
    // [catchUp]
    // Pull everything after the view's own checkpoint and apply it in order.
    // A real projector runs this on a schedule or when it is notified.
    public void CatchUp()
    {
        var pending = log.ReadAfter(view.Checkpoint);
        foreach (var logged in pending) view.Apply(logged);
        Console.WriteLine($"projector: applied {pending.Count} event(s) (checkpoint {view.Checkpoint})");
    }
    // [/catchUp]

    // [rebuild]
    // Throw the read model away and replay the whole log into it.
    public void Rebuild()
    {
        view.Reset();
        Console.WriteLine("projector: view reset");
        CatchUp();
    }
    // [/rebuild]
}
// [/projector]
