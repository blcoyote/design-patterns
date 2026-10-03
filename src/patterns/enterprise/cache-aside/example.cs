using System.Globalization;

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
const int TtlMs = 5000;

var clock = new Clock();
var db = new ProductDatabase();
var cache = new Cache<Product>(clock, TtlMs);
var service = new ProductService(db, cache);

var product = service.GetProduct("p1");
Console.WriteLine($"first read: {product.Name} ${product.Price.ToString("F2", CultureInfo.InvariantCulture)} — db calls: {db.Calls}");

product = service.GetProduct("p1");
Console.WriteLine($"second read: {product.Name} ${product.Price.ToString("F2", CultureInfo.InvariantCulture)} — db calls: {db.Calls} (hit)");

service.UpdateProduct("p1", 14.99m);
Console.WriteLine($"updated price — db calls: {db.Calls} (after invalidate)");

product = service.GetProduct("p1");
Console.WriteLine($"read after update: {product.Name} ${product.Price.ToString("F2", CultureInfo.InvariantCulture)} — db calls: {db.Calls}");

clock.Advance(TtlMs + 1);
product = service.GetProduct("p1");
Console.WriteLine($"read after TTL expiry: {product.Name} ${product.Price.ToString("F2", CultureInfo.InvariantCulture)} — db calls: {db.Calls}");
// [/client]

// [clock]
/** A fake clock: time only moves when the usage code calls Advance(). No real time anywhere. */
class Clock
{
    public long NowMs { get; private set; }

    public void Advance(long ms) => NowMs += ms;
}
// [/clock]

record Product(string Id, string Name, decimal Price);

// [database]
/** The slow source of truth. Counts every call it answers, so the demo output stays reproducible. */
class ProductDatabase
{
    public int Calls { get; private set; }
    private readonly Dictionary<string, Product> _products = new() { ["p1"] = new Product("p1", "Widget", 9.99m) };

    // [dbFind]
    public Product FindById(string id)
    {
        Calls++;
        if (!_products.TryGetValue(id, out var product))
        {
            throw new InvalidOperationException($"product {id} not found");
        }
        return product;
    }
    // [/dbFind]

    // [dbUpdate]
    public void Update(string id, decimal price)
    {
        Calls++;
        if (!_products.TryGetValue(id, out var existing))
        {
            throw new InvalidOperationException($"product {id} not found");
        }
        _products[id] = existing with { Price = price };
    }
    // [/dbUpdate]
}
// [/database]

class CacheEntry<T>
{
    public required T Value { get; init; }
    public required long ExpiresAt { get; init; }
}

// [cache]
/** An in-memory, TTL-bounded cache. The application decides when to use it — the store has no say. */
class Cache<T>(Clock clock, long ttlMs) where T : class
{
    private readonly Dictionary<string, CacheEntry<T>> _entries = new();

    // [cacheGet]
    public T? Get(string key)
    {
        if (!_entries.TryGetValue(key, out var entry)) return null;
        if (entry.ExpiresAt <= clock.NowMs)
        {
            _entries.Remove(key); // expired: treat it as a miss and drop the stale value
            return null;
        }
        return entry.Value;
    }
    // [/cacheGet]

    // [cacheSet]
    public void Set(string key, T value)
    {
        _entries[key] = new CacheEntry<T> { Value = value, ExpiresAt = clock.NowMs + ttlMs };
    }
    // [/cacheSet]

    // [cacheInvalidate]
    public void Invalidate(string key) => _entries.Remove(key);
    // [/cacheInvalidate]
}
// [/cache]

// [service]
/** Cache-Aside lives here: the service — not Cache or ProductDatabase — owns the read/write policy. */
class ProductService(ProductDatabase db, Cache<Product> cache)
{
    // [getProduct]
    public Product GetProduct(string id)
    {
        var cached = cache.Get(id);
        if (cached is not null) return cached;
        var product = db.FindById(id);
        cache.Set(id, product);
        return product;
    }
    // [/getProduct]

    // [updateProduct]
    public void UpdateProduct(string id, decimal price)
    {
        db.Update(id, price);
        // Invalidate rather than refresh in place: the next read repopulates the
        // cache straight from the source of truth, instead of trusting this one
        // write to be the only writer. See the stale-read risk in the text.
        cache.Invalidate(id);
    }
    // [/updateProduct]
}
// [/service]
