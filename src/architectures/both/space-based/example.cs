using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
var db = new Database();
var pump = new DataPump();
var grid = new DataGrid(pump);
var messaging = new MessagingGrid(grid);
var deployment = new DeploymentManager(grid, db);

deployment.Start("pu-1");
deployment.Start("pu-2");

// Two purchases, answered by pu-1 and pu-2 in turn. Neither reaches the database.
messaging.Buy("alice", "show-1");
messaging.Buy("bob", "show-1");
var stored = db.Get("show-1");
if (stored == null) throw new InvalidOperationException("unknown show show-1");
Console.WriteLine(
    $"database: show-1 seats left: {stored.SeatsLeft.ToString(CultureInfo.InvariantCulture)}, pump holds {pump.Size().ToString(CultureInfo.InvariantCulture)} writes");

// The spike: a third unit starts and copies the current state from pu-1.
deployment.Start("pu-3");
messaging.Buy("carol", "show-1");
messaging.Buy("dave", "show-1");

// The writer drains the pump: only now does the database catch up.
DataWriter.Drain(pump, db);
// [/usage]

// [records]
/// <summary>
/// The two shapes of data that move through the system. Both are immutable: a change never
/// edits a record, it makes a new one (with), so a record already handed to another unit or
/// queued for the pump can never change underneath its holder.
/// </summary>

/// What a processing unit and the database each hold about one show.
sealed record ShowRecord(string ShowId, int Capacity, int SeatsLeft);

/// One change on its way to the database: the new SeatsLeft of a show, and who caused it.
sealed record SeatWrite(string ShowId, int SeatsLeft, string Buyer);
// [/records]

// [database]
/// <summary>
/// The slow, durable store. It is the system of record, but no purchase ever touches it: the
/// data reader loads from it on a cold start, and the data writer writes to it when it drains
/// the pump.
/// A Dictionary does not promise an enumeration order, so the ids are kept in a List in
/// insertion order, and applying a write keeps the show's place.
/// </summary>
sealed class Database
{
    private readonly List<string> _ids = new() { "show-1" };
    private readonly Dictionary<string, ShowRecord> _shows = new()
    {
        ["show-1"] = new ShowRecord("show-1", 3, 3),
    };

    public ShowRecord? Get(string showId) => _shows.TryGetValue(showId, out var show) ? show : null;

    /// Every show, in insertion order.
    public List<ShowRecord> All() => _ids.Select(id => _shows[id]).ToList();

    /// Stores the write's SeatsLeft as a new record for that show.
    public void Apply(SeatWrite write)
    {
        // A write for a show the database does not have is a programmer bug.
        if (!_shows.TryGetValue(write.ShowId, out var show))
        {
            throw new InvalidOperationException($"unknown show {write.ShowId}");
        }
        _shows[write.ShowId] = show with { SeatsLeft = write.SeatsLeft };
    }
}
// [/database]

// [dataPump]
/// <summary>
/// The data pump: a first in first out queue of changes waiting for the database. The grid
/// sends to it; only the data writer takes from it.
/// </summary>
sealed class DataPump
{
    private readonly Queue<SeatWrite> _queue = new();

    public void Send(SeatWrite write) => _queue.Enqueue(write);

    public int Size() => _queue.Count;

    /// Removes and returns the oldest write, or null when the pump is empty.
    public SeatWrite? Take() => _queue.TryDequeue(out var write) ? write : null;
}

/// <summary>
/// The data writer: the only code that writes to the database. It runs only when Drain is
/// called; nothing here decides when. Real products flush on a delay or a batch size and may
/// coalesce writes to the same key; this one applies every write, one by one, in the order
/// they were sent.
/// </summary>
static class DataWriter
{
    public static void Drain(DataPump pump, Database db)
    {
        int applied = 0;
        for (var write = pump.Take(); write != null; write = pump.Take())
        {
            db.Apply(write);
            applied++;
        }
        var show = db.Get("show-1");
        if (show == null) throw new InvalidOperationException("unknown show show-1");
        Console.WriteLine(
            $"[writer] applied {applied.ToString(CultureInfo.InvariantCulture)} writes; database: {show.ShowId} seats left: {show.SeatsLeft.ToString(CultureInfo.InvariantCulture)}");
    }
}
// [/dataPump]

// [dataReader]
/// <summary>
/// The data reader: the only code that reads the database on behalf of a processing unit. It
/// is used for a cold start, when the grid has no members and so no peer to copy from.
/// </summary>
static class DataReader
{
    public static void Load(ProcessingUnit unit, Database db)
    {
        foreach (var show in db.All())
        {
            unit.Put(show);
            Console.WriteLine(
                $"[reader] {unit.Name} loaded {show.ShowId} from the database (seats left: {show.SeatsLeft.ToString(CultureInfo.InvariantCulture)})");
        }
    }
}
// [/dataReader]

// [dataGrid]
/// <summary>
/// The data grid: it knows the processing units, in the order they joined, and keeps their
/// replicas in step. Every change a unit makes is copied to the other units and forwarded to
/// the data pump; that forwarding is the write-behind. Real data grids (Hazelcast, Apache
/// Ignite, GigaSpaces) differ in the details; this simulation only shows the idea.
///
/// This simulation copies a change to every other unit immediately and runs one request at a
/// time, so no two units ever act on the same seat at once. Real grids serve requests
/// concurrently and often replicate asynchronously, so two units can both sell the last seat
/// (a data collision) unless the grid locks or version-checks that entry. This simulation
/// cannot show that.
/// </summary>
sealed class DataGrid
{
    private readonly List<ProcessingUnit> _units = new();
    private readonly DataPump _pump;

    public DataGrid(DataPump pump)
    {
        _pump = pump;
    }

    public bool HasMembers() => _units.Count > 0;

    /// A copy of the member list, in join order.
    public List<ProcessingUnit> Members() => _units.ToList();

    /// A new unit copies every record from the first member, if there is one, then becomes a member.
    public void Join(ProcessingUnit unit)
    {
        var peer = _units.FirstOrDefault();
        if (peer != null)
        {
            foreach (var record in peer.Records())
            {
                unit.Put(record);
                Console.WriteLine(
                    $"[grid] {unit.Name} copied {record.ShowId} from {peer.Name} (seats left: {record.SeatsLeft.ToString(CultureInfo.InvariantCulture)})");
            }
        }
        _units.Add(unit);
    }

    /// Puts the record into every member except the source, then forwards the change to the pump.
    public void Replicate(ProcessingUnit source, ShowRecord record, string buyer)
    {
        // Iterate a snapshot of the members, in join order.
        foreach (var member in Members())
        {
            if (!ReferenceEquals(member, source)) member.Put(record);
        }
        _pump.Send(new SeatWrite(record.ShowId, record.SeatsLeft, buyer));
    }
}
// [/dataGrid]

// [processingUnit]
/// <summary>
/// A processing unit: it answers requests from its own in-memory replica of the data and
/// never touches the database. Its replica is private; other units reach it only through the
/// grid.
/// </summary>
sealed class ProcessingUnit
{
    // Insertion order, like the database: ids in a List, records in a Dictionary.
    private readonly List<string> _ids = new();
    private readonly Dictionary<string, ShowRecord> _replica = new();
    private readonly DataGrid _grid;

    public ProcessingUnit(string name, DataGrid grid)
    {
        Name = name;
        _grid = grid;
    }

    public string Name { get; }

    /// Inserts the record, or replaces the one with the same id and keeps its place.
    public void Put(ShowRecord record)
    {
        if (!_replica.ContainsKey(record.ShowId)) _ids.Add(record.ShowId);
        _replica[record.ShowId] = record;
    }

    public ShowRecord? Get(string showId) => _replica.TryGetValue(showId, out var show) ? show : null;

    /// Every record in the replica, in insertion order.
    public List<ShowRecord> Records() => _ids.Select(id => _replica[id]).ToList();

    /// Sells one seat from the local replica. Returns false when the show is sold out.
    public bool Buy(string buyer, string showId)
    {
        // A show the unit does not hold is a programmer bug, not a sold-out answer.
        if (!_replica.TryGetValue(showId, out var show))
        {
            throw new InvalidOperationException($"{Name} has no {showId}");
        }
        if (show.SeatsLeft == 0)
        {
            Console.WriteLine($"[{Name}] {buyer} rejected: {showId} is sold out");
            return false;
        }
        int seat = show.Capacity - show.SeatsLeft + 1;
        var updated = show with { SeatsLeft = show.SeatsLeft - 1 };
        _replica[showId] = updated;
        _grid.Replicate(this, updated, buyer);
        Console.WriteLine(
            $"[{Name}] {buyer} gets seat {seat.ToString(CultureInfo.InvariantCulture)} (seats left: {updated.SeatsLeft.ToString(CultureInfo.InvariantCulture)})");
        return true;
    }
}
// [/processingUnit]

// [messagingGrid]
/// <summary>
/// The messaging grid: it takes a request and hands it to one processing unit. Here the
/// choice is round robin over the members at that moment: a counter, taken modulo the member
/// count, then incremented. Real messaging grids can also route by load or by the data a
/// request needs.
/// </summary>
sealed class MessagingGrid
{
    private int _counter = 0;
    private readonly DataGrid _grid;

    public MessagingGrid(DataGrid grid)
    {
        _grid = grid;
    }

    public bool Buy(string buyer, string showId)
    {
        // Route over a snapshot of the members, in join order.
        var members = _grid.Members();
        var unit = members.Count == 0 ? null : members[_counter % members.Count];
        if (unit == null) throw new InvalidOperationException("no processing unit is running");
        _counter++;
        return unit.Buy(buyer, showId);
    }
}
// [/messagingGrid]

// [deploymentManager]
/// <summary>
/// The deployment manager: it starts processing units when load calls for them. The first
/// unit finds an empty grid and is filled from the database by the data reader; every later
/// one copies from a peer through the grid. Real deployment managers can also watch load
/// and stop units; here the caller decides when to start one.
/// </summary>
sealed class DeploymentManager
{
    private readonly DataGrid _grid;
    private readonly Database _db;

    public DeploymentManager(DataGrid grid, Database db)
    {
        _grid = grid;
        _db = db;
    }

    public ProcessingUnit Start(string name)
    {
        Console.WriteLine($"[deploy] starting {name}");
        var unit = new ProcessingUnit(name, _grid);
        // Cold start: nobody to copy from, so read the database.
        if (!_grid.HasMembers()) DataReader.Load(unit, _db);
        // For the first unit Join copies nothing; for a later one it copies from a peer.
        _grid.Join(unit);
        return unit;
    }
}
// [/deploymentManager]
