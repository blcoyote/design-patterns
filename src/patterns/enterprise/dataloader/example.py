from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: str
    name: str


@dataclass(frozen=True)
class Post:
    id: str
    author_id: str


# [database]
class UserDatabase:
    def __init__(self) -> None:
        # Rows are stored (and come back) in this order, not in the order they were asked for.
        self._users = [User('u2', 'Grace'), User('u1', 'Ada')]
        # Counts every query so the demo output stays reproducible.
        self.queries = 0

    # [dbFind]
    # One round trip for any number of ids, like SELECT … WHERE id IN (…).
    def find_by_ids(self, ids: list[str]) -> list[User]:
        self.queries += 1
        print(f"db: SELECT users WHERE id IN ({', '.join(ids)})")
        return [user for user in self._users if user.id in ids]
    # [/dbFind]
# [/database]


# The result of a load() that may not have run yet.
class Pending:
    def __init__(self) -> None:
        self._user: User | None = None

    def resolve(self, user: User) -> None:
        self._user = user

    def get(self) -> User:
        if self._user is None:
            raise RuntimeError('not loaded yet: dispatch() has not run')
        return self._user


# Without a loader: every post asks the database for its own author.
class NaiveResolver:
    def __init__(self, db: UserDatabase) -> None:
        self._db = db

    def author(self, post: Post) -> User:
        # [naiveAuthor]
        return self._db.find_by_ids([post.author_id])[0]
        # [/naiveAuthor]


# [userLoader]
# One loader per request: its cache must not outlive the request, or it would
# serve stale data and leak users across requests.
# Real loaders dispatch by themselves at the end of the current tick (JavaScript's
# DataLoader uses a microtask); here dispatch() is called by hand so the batching
# moment is visible and every language behaves the same.
class UserLoader:
    def __init__(self, db: UserDatabase) -> None:
        self._db = db
        self._cache: dict[str, Pending] = {}
        self._queue: list[str] = []

    def load(self, id: str) -> Pending:
        # [loaderLoad]
        # The cache holds queued keys too, so a repeated id shares one slot: it is
        # neither queued twice nor fetched twice.
        known = self._cache.get(id)
        if known is not None:
            return known
        pending = Pending()
        self._cache[id] = pending
        self._queue.append(id)
        return pending
        # [/loaderLoad]

    def dispatch(self) -> None:
        # [loaderBatch]
        # Take the whole queue, ask once, then match rows back to keys by id,
        # because the database may return them in any order.
        keys = self._queue
        self._queue = []
        if not keys:
            return
        by_id = {user.id: user for user in self._db.find_by_ids(keys)}
        for key in keys:
            user = by_id.get(key)
            if user is None:
                raise ValueError(f'user {key} not found')
            self._cache[key].resolve(user)
        # [/loaderBatch]
# [/userLoader]


# [postResolver]
class PostResolver:
    def __init__(self, users: UserLoader) -> None:
        self._users = users

    # Returns at once with a Pending result; no query has run yet.
    def author(self, post: Post) -> Pending:
        return self._users.load(post.author_id)
# [/postResolver]


# [client]
posts = [Post('P1', 'u1'), Post('P2', 'u2'), Post('P3', 'u1')]

# Without a loader: one query per post (the N+1 problem).
db = UserDatabase()
naive = NaiveResolver(db)
for post in posts:
    print(f'{post.id} by {naive.author(post).name}')
# db: SELECT users WHERE id IN (u1)
# P1 by Ada
# db: SELECT users WHERE id IN (u2)
# P2 by Grace
# db: SELECT users WHERE id IN (u1)
# P3 by Ada
print(f'queries: {db.queries}')
# queries: 3

# With a loader: all three posts share one query.
db.queries = 0
loader = UserLoader(db)
resolver = PostResolver(loader)
authors = [resolver.author(post) for post in posts]
print(f'queries so far: {db.queries}')
# queries so far: 0
loader.dispatch()  # the end of the tick
# db: SELECT users WHERE id IN (u1, u2)
for post, author in zip(posts, authors):
    print(f'{post.id} by {author.get().name}')
# P1 by Ada
# P2 by Grace
# P3 by Ada
print(f"cached u1: {loader.load('u1').get().name}")
# cached u1: Ada
print(f'queries: {db.queries}')
# queries: 1
# [/client]
