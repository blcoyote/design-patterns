// [clock]
/** A fake clock: time only moves when the usage code calls advance(). No real time anywhere. */
class Clock {
  nowMs = 0

  advance(ms: number): void {
    this.nowMs += ms
  }
}
// [/clock]

interface Product {
  id: string
  name: string
  price: number
}

// [database]
/** The slow source of truth. Counts every call it answers, so the demo output stays reproducible. */
class ProductDatabase {
  calls = 0
  private products = new Map<string, Product>([['p1', { id: 'p1', name: 'Widget', price: 9.99 }]])

  // [dbFind]
  findById(id: string): Product {
    this.calls++
    const product = this.products.get(id)
    if (!product) throw new Error(`product ${id} not found`)
    return product
  }
  // [/dbFind]

  // [dbUpdate]
  update(id: string, price: number): void {
    this.calls++
    const existing = this.products.get(id)
    if (!existing) throw new Error(`product ${id} not found`)
    this.products.set(id, { ...existing, price })
  }
  // [/dbUpdate]
}
// [/database]

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

// [cache]
/** An in-memory, TTL-bounded cache. The application decides when to use it — the store has no say. */
class Cache<T> {
  private entries = new Map<string, CacheEntry<T>>()

  constructor(
    private clock: Clock,
    private ttlMs: number,
  ) {}

  // [cacheGet]
  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.clock.nowMs) {
      this.entries.delete(key) // expired: treat it as a miss and drop the stale value
      return undefined
    }
    return entry.value
  }
  // [/cacheGet]

  // [cacheSet]
  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: this.clock.nowMs + this.ttlMs })
  }
  // [/cacheSet]

  // [cacheInvalidate]
  invalidate(key: string): void {
    this.entries.delete(key)
  }
  // [/cacheInvalidate]
}
// [/cache]

// [service]
/** Cache-Aside lives here: the service — not Cache or ProductDatabase — owns the read/write policy. */
class ProductService {
  constructor(
    private db: ProductDatabase,
    private cache: Cache<Product>,
  ) {}

  // [getProduct]
  getProduct(id: string): Product {
    const cached = this.cache.get(id)
    if (cached) return cached
    const product = this.db.findById(id)
    this.cache.set(id, product)
    return product
  }
  // [/getProduct]

  // [updateProduct]
  updateProduct(id: string, price: number): void {
    this.db.update(id, price)
    // Invalidate rather than refresh in place: the next read repopulates the
    // cache straight from the source of truth, instead of trusting this one
    // write to be the only writer. See the stale-read risk in the text.
    this.cache.invalidate(id)
  }
  // [/updateProduct]
}
// [/service]

// [client]
// Usage
const TTL_MS = 5000

const clock = new Clock()
const db = new ProductDatabase()
const cache = new Cache<Product>(clock, TTL_MS)
const service = new ProductService(db, cache)

let product = service.getProduct('p1')
console.log(`first read: ${product.name} $${product.price.toFixed(2)} — db calls: ${db.calls}`)

product = service.getProduct('p1')
console.log(`second read: ${product.name} $${product.price.toFixed(2)} — db calls: ${db.calls} (hit)`)

service.updateProduct('p1', 14.99)
console.log(`updated price — db calls: ${db.calls} (after invalidate)`)

product = service.getProduct('p1')
console.log(`read after update: ${product.name} $${product.price.toFixed(2)} — db calls: ${db.calls}`)

clock.advance(TTL_MS + 1)
product = service.getProduct('p1')
console.log(`read after TTL expiry: ${product.name} $${product.price.toFixed(2)} — db calls: ${db.calls}`)
// [/client]
