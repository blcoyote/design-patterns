from dataclasses import dataclass, replace
from typing import Generic, TypeVar


# [clock]
class Clock:
    """A fake clock: time only moves when the usage code calls advance(). No real time anywhere."""

    def __init__(self) -> None:
        self.now_ms = 0

    def advance(self, ms: int) -> None:
        self.now_ms += ms
# [/clock]


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    price: float


# [database]
class ProductDatabase:
    """The slow source of truth. Counts every call it answers, so the demo output stays reproducible."""

    def __init__(self) -> None:
        self.calls = 0
        self._products: dict[str, Product] = {'p1': Product('p1', 'Widget', 9.99)}

    # [dbFind]
    def find_by_id(self, id: str) -> Product:
        self.calls += 1
        product = self._products.get(id)
        if product is None:
            raise ValueError(f'product {id} not found')
        return product
    # [/dbFind]

    # [dbUpdate]
    def update(self, id: str, price: float) -> None:
        self.calls += 1
        existing = self._products.get(id)
        if existing is None:
            raise ValueError(f'product {id} not found')
        self._products[id] = replace(existing, price=price)
    # [/dbUpdate]
# [/database]


T = TypeVar('T')


@dataclass
class CacheEntry(Generic[T]):
    value: T
    expires_at: int


# [cache]
class Cache(Generic[T]):
    """An in-memory, TTL-bounded cache. The application decides when to use it — the store has no say."""

    def __init__(self, clock: Clock, ttl_ms: int) -> None:
        self._clock = clock
        self._ttl_ms = ttl_ms
        self._entries: dict[str, CacheEntry[T]] = {}

    # [cacheGet]
    def get(self, key: str) -> T | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= self._clock.now_ms:
            del self._entries[key]  # expired: treat it as a miss and drop the stale value
            return None
        return entry.value
    # [/cacheGet]

    # [cacheSet]
    def set(self, key: str, value: T) -> None:
        self._entries[key] = CacheEntry(value, self._clock.now_ms + self._ttl_ms)
    # [/cacheSet]

    # [cacheInvalidate]
    def invalidate(self, key: str) -> None:
        self._entries.pop(key, None)
    # [/cacheInvalidate]
# [/cache]


# [service]
class ProductService:
    """Cache-Aside lives here: the service — not Cache or ProductDatabase — owns the read/write policy."""

    def __init__(self, db: ProductDatabase, cache: Cache[Product]) -> None:
        self._db = db
        self._cache = cache

    # [getProduct]
    def get_product(self, id: str) -> Product:
        cached = self._cache.get(id)
        if cached is not None:
            return cached
        product = self._db.find_by_id(id)
        self._cache.set(id, product)
        return product
    # [/getProduct]

    # [updateProduct]
    def update_product(self, id: str, price: float) -> None:
        self._db.update(id, price)
        # Invalidate rather than refresh in place: the next read repopulates the
        # cache straight from the source of truth, instead of trusting this one
        # write to be the only writer. See the stale-read risk in the text.
        self._cache.invalidate(id)
    # [/updateProduct]
# [/service]


# [client]
# Usage
TTL_MS = 5000

clock = Clock()
db = ProductDatabase()
cache: Cache[Product] = Cache(clock, TTL_MS)
service = ProductService(db, cache)

product = service.get_product('p1')
print(f'first read: {product.name} ${product.price:.2f} — db calls: {db.calls}')

product = service.get_product('p1')
print(f'second read: {product.name} ${product.price:.2f} — db calls: {db.calls} (hit)')

service.update_product('p1', 14.99)
print(f'updated price — db calls: {db.calls} (after invalidate)')

product = service.get_product('p1')
print(f'read after update: {product.name} ${product.price:.2f} — db calls: {db.calls}')

clock.advance(TTL_MS + 1)
product = service.get_product('p1')
print(f'read after TTL expiry: {product.name} ${product.price:.2f} — db calls: {db.calls}')
# [/client]
