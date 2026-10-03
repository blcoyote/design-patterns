import asyncio
from typing import Callable, Generic, Protocol, TypeVar


# [database]
class RawDatabaseSocket:
    """The expensive real resource being pooled — e.g. a raw DB/TCP socket."""

    def __init__(self, id: int) -> None:
        self.id = id

    def query(self, sql: str) -> None:
        print(f"socket#{self.id} -> {sql}")
# [/database]


# [poolable]
class Poolable(Protocol):
    def reset(self) -> None:
        """Clears any per-borrower state before the object is handed to someone new."""
        ...
# [/poolable]


# [connection]
class PooledConnection:
    def __init__(self, socket: RawDatabaseSocket) -> None:
        self._socket = socket
        self._tx_open = False

    def query(self, sql: str) -> None:
        self._socket.query(sql)

    def begin_transaction(self) -> None:
        self._tx_open = True

    # [reset]
    def reset(self) -> None:
        self._tx_open = False  # never leak an open transaction to the next borrower
    # [/reset]
# [/connection]


T = TypeVar("T", bound=Poolable)


# [pool]
class ObjectPool(Generic[T]):
    def __init__(self, factory: Callable[[], T], max_size: int) -> None:
        self._factory = factory
        self._max_size = max_size
        self._idle: list[T] = []
        self._in_use: set[T] = set()
        self._waiting: list[asyncio.Future] = []
        self._created = 0

    # [acquire]
    def acquire(self) -> "asyncio.Future[T]":
        # Not `async def`: the queueing decision below must happen synchronously,
        # the moment acquire() is called — exactly like the TS version, which
        # returns a Promise without ever awaiting inside this method.
        loop = asyncio.get_running_loop()
        if self._idle:
            reused = self._idle.pop()
            self._in_use.add(reused)
            future: asyncio.Future = loop.create_future()
            future.set_result(reused)
            return future
        if self._created < self._max_size:
            item = self._factory()  # lazy creation — if this throws, no slot is used up
            self._created += 1  # only count it once the object actually exists
            self._in_use.add(item)
            future = loop.create_future()
            future.set_result(item)
            return future
        # Every slot is taken: queue this request until a release() frees one up.
        future = loop.create_future()
        self._waiting.append(future)
        return future
    # [/acquire]

    # [release]
    def release(self, item: T) -> None:
        if item not in self._in_use:
            raise RuntimeError("release() called with an item that is not checked out from this pool")
        self._in_use.discard(item)
        item.reset()  # scrub borrower state before anyone else sees this object
        if self._waiting:
            next_waiter = self._waiting.pop(0)
            self._in_use.add(item)
            next_waiter.set_result(item)  # hand it straight to the waiting caller — it never goes idle
        else:
            self._idle.append(item)
    # [/release]

    @property
    def stats(self) -> dict[str, int]:
        return {"idle": len(self._idle), "in_use": len(self._in_use), "waiting": len(self._waiting)}
# [/pool]


# [usage]
next_socket_id = 0


def make_connection() -> PooledConnection:
    global next_socket_id
    next_socket_id += 1
    return PooledConnection(RawDatabaseSocket(next_socket_id))


async def main() -> None:
    pool = ObjectPool[PooledConnection](make_connection, 3)

    # [clientA]
    conn_a = await pool.acquire()  # pool is empty — lazily creates connection #1
    conn_a.query("SELECT 1")
    pool.release(conn_a)  # reset, then back to idle (or straight to a waiter)
    # [/clientA]

    # [clientB]
    # Fill every slot (maxSize = 3), then watch a caller queue and get served:
    c1, c2, c3 = await asyncio.gather(pool.acquire(), pool.acquire(), pool.acquire())
    c2.query("SELECT 2")
    c3.query("SELECT 3")

    pending = pool.acquire()  # queued: every slot is already checked out
    pool.release(c1)  # handed straight to the queued caller instead of going idle
    c4 = await pending  # c4 is c1, reused rather than freshly constructed
    # [/clientB]


asyncio.run(main())
# [/usage]
