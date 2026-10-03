// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).

// [client]
var db = new SqlDatabase();
var uow = new UnitOfWork(db);

var order = new TrackedEntity("order-104");
var customer = new TrackedEntity("customer-58");
var cart = new TrackedEntity("cart-9");

uow.RegisterNew(order);
uow.RegisterDirty(customer);
uow.RegisterRemoved(cart);
uow.RegisterDirty(customer); // already tracked — ignored

uow.Commit();
// BEGIN
// INSERT order-104
// UPDATE customer-58
// DELETE cart-9
// COMMIT
// [/client]

interface IEntity
{
    string Id { get; }
}

class TrackedEntity(string id) : IEntity
{
    public string Id { get; } = id;
}

interface IDatabase
{
    void BeginTransaction();
    void Insert(IEntity entity);
    void Update(IEntity entity);
    void Delete(IEntity entity);
    void CommitTransaction();
    void RollbackTransaction();
}

// [database]
class SqlDatabase : IDatabase
{
    public void BeginTransaction() => Console.WriteLine("BEGIN");
    public void Insert(IEntity entity) => Console.WriteLine($"INSERT {entity.Id}");
    public void Update(IEntity entity) => Console.WriteLine($"UPDATE {entity.Id}");
    public void Delete(IEntity entity) => Console.WriteLine($"DELETE {entity.Id}");
    public void CommitTransaction() => Console.WriteLine("COMMIT");
    public void RollbackTransaction() => Console.WriteLine("ROLLBACK");
}
// [/database]

// [unitOfWork]
class UnitOfWork(IDatabase db)
{
    // [pendingNew]
    private readonly List<IEntity> _newObjects = new();
    // [/pendingNew]
    // [pendingDirty]
    private readonly List<IEntity> _dirtyObjects = new();
    // [/pendingDirty]
    // [pendingRemoved]
    private readonly List<IEntity> _removedObjects = new();
    // [/pendingRemoved]

    // [register]
    // Note: entities are tracked by reference (List.Contains uses the default
    // equality comparer), so the very same object instance must be passed to
    // every register*() call for an entity. Real Unit of Work implementations
    // pair this with an Identity Map so a given row only ever has one
    // in-memory instance to begin with.

    // [registerNew]
    public void RegisterNew(IEntity entity)
    {
        // Guards against double-registering the same still-unsaved entity as new.
        if (!_newObjects.Contains(entity)) _newObjects.Add(entity);
    }
    // [/registerNew]

    // [registerDirty]
    public void RegisterDirty(IEntity entity)
    {
        // Skips entities already queued as new (nothing to UPDATE yet) or already
        // marked dirty (no point queuing the same UPDATE twice).
        var alreadyTracked = _newObjects.Contains(entity) || _dirtyObjects.Contains(entity);
        if (!alreadyTracked) _dirtyObjects.Add(entity);
    }
    // [/registerDirty]

    // [registerRemoved]
    public void RegisterRemoved(IEntity entity)
    {
        var wasNew = _newObjects.Contains(entity);
        // Whatever it was before, there is nothing left to insert or update.
        _newObjects.Remove(entity);
        _dirtyObjects.Remove(entity);
        // A row that was never inserted has nothing to delete.
        if (!wasNew && !_removedObjects.Contains(entity)) _removedObjects.Add(entity);
    }
    // [/registerRemoved]
    // [/register]

    // [commit]
    public void Commit()
    {
        db.BeginTransaction();
        try
        {
            // One statement per entity, in order: this example trades round trips
            // for simplicity. The atomicity guarantee comes from the single
            // transaction wrapping all of them, not from how many statements it
            // took to get there — a real ORM can batch these into fewer round trips.
            foreach (var entity in _newObjects) db.Insert(entity);
            foreach (var entity in _dirtyObjects) db.Update(entity);
            foreach (var entity in _removedObjects) db.Delete(entity);
            db.CommitTransaction();
            _newObjects.Clear();
            _dirtyObjects.Clear();
            _removedObjects.Clear();
        }
        catch
        {
            db.RollbackTransaction(); // none of the writes above take effect
            throw;
        }
    }
    // [/commit]
}
// [/unitOfWork]
