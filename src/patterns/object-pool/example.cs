// [usage]
var pool = new ObjectPool<PooledConnection>(() => new PooledConnection(new RawDatabaseSocket(Environment.TickCount64)), 3);

// [clientA]
var connA = await pool.AcquireAsync(); // pool is empty — lazily creates connection #1
connA.Query("SELECT 1");
pool.Release(connA); // reset, then back to idle (or straight to a waiter)
// [/clientA]

// [clientB]
// Fill every slot (maxSize = 3), then watch a caller queue and get served:
var t1 = pool.AcquireAsync();
var t2 = pool.AcquireAsync();
var t3 = pool.AcquireAsync();
await Task.WhenAll(t1, t2, t3);
var c1 = t1.Result;
var c2 = t2.Result;
var c3 = t3.Result;
c2.Query("SELECT 2");
c3.Query("SELECT 3");

var pending = pool.AcquireAsync(); // queued: every slot is already checked out
pool.Release(c1); // handed straight to the queued caller instead of going idle
var c4 = await pending; // c4 === c1, reused rather than freshly constructed
// [/clientB]
// [/usage]

// [database]
/** The expensive real resource being pooled — e.g. a raw DB/TCP socket. */
class RawDatabaseSocket(long id)
{
    public long Id { get; } = id;

    public void Query(string sql) => Console.WriteLine($"socket#{Id} -> {sql}");
}
// [/database]

// [poolable]
interface IPoolable
{
    /** Clears any per-borrower state before the object is handed to someone new. */
    void Reset();
}
// [/poolable]

// [connection]
class PooledConnection(RawDatabaseSocket socket) : IPoolable
{
#pragma warning disable CS0414 // tracked for Reset() to clear — never read elsewhere, same as the TS sample
    private bool _txOpen;
#pragma warning restore CS0414

    public void Query(string sql) => socket.Query(sql);

    public void BeginTransaction() => _txOpen = true;

    // [reset]
    public void Reset()
    {
        _txOpen = false; // never leak an open transaction to the next borrower
    }
    // [/reset]
}
// [/connection]

// [pool]
class ObjectPool<T>(Func<T> factory, int maxSize) where T : IPoolable
{
    private readonly List<T> _idle = new();
    private readonly HashSet<T> _inUse = new();
    private readonly Queue<TaskCompletionSource<T>> _waiting = new();
    private int _created;

    // [acquire]
    public Task<T> AcquireAsync()
    {
        if (_idle.Count > 0)
        {
            var reused = _idle[^1];
            _idle.RemoveAt(_idle.Count - 1);
            _inUse.Add(reused);
            return Task.FromResult(reused);
        }
        if (_created < maxSize)
        {
            var item = factory(); // lazy creation — if this throws, no slot is used up
            _created++; // only count it once the object actually exists
            _inUse.Add(item);
            return Task.FromResult(item);
        }
        // Every slot is taken: queue this request until a Release() frees one up.
        var tcs = new TaskCompletionSource<T>();
        _waiting.Enqueue(tcs);
        return tcs.Task;
    }
    // [/acquire]

    // [release]
    public void Release(T item)
    {
        if (!_inUse.Remove(item))
        {
            throw new InvalidOperationException("Release() called with an item that is not checked out from this pool");
        }
        item.Reset(); // scrub borrower state before anyone else sees this object
        if (_waiting.Count > 0)
        {
            var next = _waiting.Dequeue();
            _inUse.Add(item);
            next.SetResult(item); // hand it straight to the waiting caller — it never goes idle
        }
        else
        {
            _idle.Add(item);
        }
    }
    // [/release]

    public (int Idle, int InUse, int Waiting) Stats => (_idle.Count, _inUse.Count, _waiting.Count);
}
// [/pool]
