// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var posts = new List<Post> { new("P1", "u1"), new("P2", "u2"), new("P3", "u1") };

// Without a loader: one query per post (the N+1 problem).
var db = new UserDatabase();
var naive = new NaiveResolver(db);
foreach (var post in posts) Console.WriteLine($"{post.Id} by {naive.Author(post).Name}");
// db: SELECT users WHERE id IN (u1)
// P1 by Ada
// db: SELECT users WHERE id IN (u2)
// P2 by Grace
// db: SELECT users WHERE id IN (u1)
// P3 by Ada
Console.WriteLine($"queries: {db.Queries}");
// queries: 3

// With a loader: all three posts share one query.
db.Queries = 0;
var loader = new UserLoader(db);
var resolver = new PostResolver(loader);
var authors = posts.Select(post => resolver.Author(post)).ToList();
Console.WriteLine($"queries so far: {db.Queries}");
// queries so far: 0
loader.Dispatch(); // the end of the tick
// db: SELECT users WHERE id IN (u1, u2)
for (var i = 0; i < posts.Count; i++)
    Console.WriteLine($"{posts[i].Id} by {authors[i].Get().Name}");
// P1 by Ada
// P2 by Grace
// P3 by Ada
Console.WriteLine($"cached u1: {loader.Load("u1").Get().Name}");
// cached u1: Ada
Console.WriteLine($"queries: {db.Queries}");
// queries: 1
// [/client]

record User(string Id, string Name);
record Post(string Id, string AuthorId);

// [database]
class UserDatabase
{
    // Rows are stored (and come back) in this order, not in the order they were asked for.
    private readonly List<User> users = new() { new("u2", "Grace"), new("u1", "Ada") };
    // Counts every query so the demo output stays reproducible.
    public int Queries;

    // [dbFind]
    // One round trip for any number of ids, like SELECT … WHERE id IN (…).
    public List<User> FindByIds(List<string> ids)
    {
        Queries++;
        Console.WriteLine($"db: SELECT users WHERE id IN ({string.Join(", ", ids)})");
        return users.Where(user => ids.Contains(user.Id)).ToList();
    }
    // [/dbFind]
}
// [/database]

// The result of a Load() that may not have run yet.
class Pending
{
    private User? user;

    public void Resolve(User value) => user = value;

    public User Get() =>
        user ?? throw new InvalidOperationException("not loaded yet: Dispatch() has not run");
}

// Without a loader: every post asks the database for its own author.
class NaiveResolver(UserDatabase db)
{
    public User Author(Post post)
    {
        // [naiveAuthor]
        return db.FindByIds(new List<string> { post.AuthorId })[0];
        // [/naiveAuthor]
    }
}

// [userLoader]
// One loader per request: its cache must not outlive the request, or it would
// serve stale data and leak users across requests.
// Real loaders dispatch by themselves at the end of the current tick (JavaScript's
// DataLoader uses a microtask); here Dispatch() is called by hand so the batching
// moment is visible and every language behaves the same.
class UserLoader(UserDatabase db)
{
    private readonly Dictionary<string, Pending> cache = new();
    private List<string> queue = new();

    public Pending Load(string id)
    {
        // [loaderLoad]
        // The cache holds queued keys too, so a repeated id shares one slot: it is
        // neither queued twice nor fetched twice.
        if (cache.TryGetValue(id, out var known)) return known;
        var pending = new Pending();
        cache[id] = pending;
        queue.Add(id);
        return pending;
        // [/loaderLoad]
    }

    public void Dispatch()
    {
        // [loaderBatch]
        // Take the whole queue, ask once, then match rows back to keys by id,
        // because the database may return them in any order.
        var keys = queue;
        queue = new List<string>();
        if (keys.Count == 0) return;
        var byId = db.FindByIds(keys).ToDictionary(user => user.Id);
        foreach (var key in keys)
        {
            if (!byId.TryGetValue(key, out var user))
                throw new InvalidOperationException($"user {key} not found");
            cache[key].Resolve(user);
        }
        // [/loaderBatch]
    }
}
// [/userLoader]

// [postResolver]
class PostResolver(UserLoader users)
{
    // Returns at once with a Pending result; no query has run yet.
    public Pending Author(Post post) => users.Load(post.AuthorId);
}
// [/postResolver]
