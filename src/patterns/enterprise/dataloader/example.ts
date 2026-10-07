interface User {
  id: string;
  name: string;
}

interface Post {
  id: string;
  authorId: string;
}

// [database]
class UserDatabase {
  // Rows are stored (and come back) in this order, not in the order they were asked for.
  private users: User[] = [
    { id: "u2", name: "Grace" },
    { id: "u1", name: "Ada" },
  ];
  // Counts every query so the demo output stays reproducible.
  queries = 0;

  // [dbFind]
  // One round trip for any number of ids, like SELECT … WHERE id IN (…).
  findByIds(ids: string[]): User[] {
    this.queries++;
    console.log(`db: SELECT users WHERE id IN (${ids.join(", ")})`);
    return this.users.filter((user) => ids.includes(user.id));
  }
  // [/dbFind]
}
// [/database]

// The result of a load() that may not have run yet.
class Pending {
  private user?: User;

  resolve(user: User): void {
    this.user = user;
  }
  get(): User {
    if (!this.user) throw new Error("not loaded yet: dispatch() has not run");
    return this.user;
  }
}

// Without a loader: every post asks the database for its own author.
class NaiveResolver {
  constructor(private db: UserDatabase) {}

  author(post: Post): User {
    // [naiveAuthor]
    return this.db.findByIds([post.authorId])[0];
    // [/naiveAuthor]
  }
}

// [userLoader]
// One loader per request: its cache must not outlive the request, or it would
// serve stale data and leak users across requests.
// Real loaders dispatch by themselves at the end of the current tick (JavaScript's
// DataLoader uses a microtask); here dispatch() is called by hand so the batching
// moment is visible and every language behaves the same.
class UserLoader {
  private cache = new Map<string, Pending>();
  private queue: string[] = [];

  constructor(private db: UserDatabase) {}

  load(id: string): Pending {
    // [loaderLoad]
    // The cache holds queued keys too, so a repeated id shares one slot: it is
    // neither queued twice nor fetched twice.
    const known = this.cache.get(id);
    if (known) return known;
    const pending = new Pending();
    this.cache.set(id, pending);
    this.queue.push(id);
    return pending;
    // [/loaderLoad]
  }

  dispatch(): void {
    // [loaderBatch]
    // Take the whole queue, ask once, then match rows back to keys by id,
    // because the database may return them in any order.
    const keys = this.queue;
    this.queue = [];
    if (keys.length === 0) return;
    const byId = new Map(this.db.findByIds(keys).map((user) => [user.id, user]));
    for (const key of keys) {
      const user = byId.get(key);
      if (!user) throw new Error(`user ${key} not found`);
      this.cache.get(key)!.resolve(user);
    }
    // [/loaderBatch]
  }
}
// [/userLoader]

// [postResolver]
class PostResolver {
  constructor(private users: UserLoader) {}

  // Returns at once with a Pending result; no query has run yet.
  author(post: Post): Pending {
    return this.users.load(post.authorId);
  }
}
// [/postResolver]

// [client]
const posts: Post[] = [
  { id: "P1", authorId: "u1" },
  { id: "P2", authorId: "u2" },
  { id: "P3", authorId: "u1" },
];

// Without a loader: one query per post (the N+1 problem).
const db = new UserDatabase();
const naive = new NaiveResolver(db);
for (const post of posts) console.log(`${post.id} by ${naive.author(post).name}`);
// db: SELECT users WHERE id IN (u1)
// P1 by Ada
// db: SELECT users WHERE id IN (u2)
// P2 by Grace
// db: SELECT users WHERE id IN (u1)
// P3 by Ada
console.log(`queries: ${db.queries}`);
// queries: 3

// With a loader: all three posts share one query.
db.queries = 0;
const loader = new UserLoader(db);
const resolver = new PostResolver(loader);
const authors = posts.map((post) => resolver.author(post));
console.log(`queries so far: ${db.queries}`);
// queries so far: 0
loader.dispatch(); // the end of the tick
// db: SELECT users WHERE id IN (u1, u2)
posts.forEach((post, i) => console.log(`${post.id} by ${authors[i].get().name}`));
// P1 by Ada
// P2 by Grace
// P3 by Ada
console.log(`cached u1: ${loader.load("u1").get().name}`);
// cached u1: Ada
console.log(`queries: ${db.queries}`);
// queries: 1
// [/client]
