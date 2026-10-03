// [database]
/** The expensive real resource being pooled — e.g. a raw DB/TCP socket. */
class RawDatabaseSocket {
  constructor(public readonly id: number) {}

  query(sql: string): void {
    console.log(`socket#${this.id} -> ${sql}`);
  }
}
// [/database]

// [poolable]
interface Poolable {
  /** Clears any per-borrower state before the object is handed to someone new. */
  reset(): void;
}
// [/poolable]

// [connection]
class PooledConnection implements Poolable {
  private txOpen = false;

  constructor(private readonly socket: RawDatabaseSocket) {}

  query(sql: string): void {
    this.socket.query(sql);
  }

  beginTransaction(): void {
    this.txOpen = true;
  }

  // [reset]
  reset(): void {
    this.txOpen = false; // never leak an open transaction to the next borrower
  }
  // [/reset]
}
// [/connection]

// [pool]
class ObjectPool<T extends Poolable> {
  private readonly idle: T[] = [];
  private readonly inUse = new Set<T>();
  private readonly waiting: Array<(item: T) => void> = [];
  private created = 0;

  constructor(
    private readonly factory: () => T,
    private readonly maxSize: number,
  ) {}

  // [acquire]
  acquire(): Promise<T> {
    const reused = this.idle.pop();
    if (reused) {
      this.inUse.add(reused);
      return Promise.resolve(reused);
    }
    if (this.created < this.maxSize) {
      const item = this.factory(); // lazy creation — if this throws, no slot is used up
      this.created++; // only count it once the object actually exists
      this.inUse.add(item);
      return Promise.resolve(item);
    }
    // Every slot is taken: queue this request until a release() frees one up.
    return new Promise((resolve) => this.waiting.push(resolve));
  }
  // [/acquire]

  // [release]
  release(item: T): void {
    if (!this.inUse.delete(item)) {
      throw new Error("release() called with an item that is not checked out from this pool");
    }
    item.reset(); // scrub borrower state before anyone else sees this object
    const next = this.waiting.shift();
    if (next) {
      this.inUse.add(item);
      next(item); // hand it straight to the waiting caller — it never goes idle
    } else {
      this.idle.push(item);
    }
  }
  // [/release]

  get stats() {
    return { idle: this.idle.length, inUse: this.inUse.size, waiting: this.waiting.length };
  }
}
// [/pool]

// [usage]
let nextSocketId = 0;
const pool = new ObjectPool<PooledConnection>(
  () => new PooledConnection(new RawDatabaseSocket(++nextSocketId)),
  3,
);

// [clientA]
const connA = await pool.acquire(); // pool is empty — lazily creates connection #1
connA.query("SELECT 1");
pool.release(connA); // reset, then back to idle (or straight to a waiter)
// [/clientA]

// [clientB]
// Fill every slot (maxSize = 3), then watch a caller queue and get served:
const [c1, c2, c3] = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);
c2.query("SELECT 2");
c3.query("SELECT 3");

const pending = pool.acquire(); // queued: every slot is already checked out
pool.release(c1); // handed straight to the queued caller instead of going idle
const c4 = await pending; // c4 === c1, reused rather than freshly constructed
// [/clientB]
// [/usage]
