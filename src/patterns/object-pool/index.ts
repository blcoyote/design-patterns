import type { PatternDefinition } from '@/types/pattern'
import { ObjectPoolVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'object-pool',
  name: 'Object Pool',
  category: 'architectural',
  order: 7,
  summary: 'Reuse a fixed set of expensive-to-create objects instead of constructing and destroying them for every request.',
  intent:
    'Manage a set of initialized objects ready to use — a pool — rather than creating and destroying them on demand, handing one out on acquire() and reclaiming it on release().',
  problem:
    'Some objects are expensive to create — a database connection, a thread, a game bullet with its own physics state — yet an application may need one for only a few milliseconds at a time. Constructing a fresh one for every request, and garbage-collecting it right after, wastes CPU and, for things like sockets or threads, can exhaust the underlying system resource long before the application itself runs out of memory.',
  solution:
    'Keep a bounded collection of pre-built, reusable objects behind acquire()/release() methods. acquire() hands out an idle object if one exists, lazily creates a new one if the pool has not yet reached its max size, or queues the caller if every object is already checked out. release() clears the object\'s per-borrower state and either returns it to the idle list or hands it straight to the next caller waiting in that queue.',
  analogy:
    'A library with a fixed shelf of three loaner laptops: borrowing one just means walking to the desk, not buying a new laptop. If all three are checked out, the next person waits in line and gets the very next one returned — wiped clean of the previous borrower\'s files first.',
  whenToUse: [
    'Creating an instance is measurably expensive — a network/database connection, a thread, a large buffer — compared to reusing one.',
    'Many short-lived borrowers need the same kind of object, one at a time, in quick succession.',
    'The number of instances in play at once should be capped, not left to grow unbounded.',
    'Each object can be reset to a clean, reusable state after use — nothing from one borrower may leak into the next.',
  ],
  pros: [
    'Avoids the cost of repeated construction/teardown for expensive resources.',
    'Caps how many instances exist at once, protecting a limited external resource (connections, threads, sockets).',
    'Smooths out load: a burst of short requests reuses the same handful of objects instead of spawning new ones for each.',
  ],
  cons: [
    'An object that is never released leaks a slot forever — pools need timeouts or owner tracking to catch this.',
    'A reset that misses some piece of state lets it leak between borrowers, causing hard-to-reproduce bugs.',
    'Adds moving parts — idle lists, in-use tracking, a waiting queue — for a problem plain allocation would solve for free with cheap objects.',
  ],
  realWorld: [
    'Database connection pools — HikariCP, node-postgres\'s Pool, ADO.NET connection pooling.',
    'java.util.concurrent.ThreadPoolExecutor (a task-submission variant of this pattern) and Node.js worker pools such as piscina — Node\'s own worker_threads module ships no pool.',
    'Game engines reusing bullet/particle/enemy objects instead of allocating and garbage-collecting them every frame.',
    'HTTP keep-alive / socket pools reused across outgoing requests to the same host.',
  ],
  related: ['flyweight', 'singleton', 'factory-method', 'prototype'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'clientA',
      label: 'Client A',
      role: 'Client',
      kind: 'client',
      x: 120,
      y: 150,
      description:
        'Borrows a connection to do some work. It only ever calls acquire() and release() — it has no idea whether its connection is brand-new or being reused for the fifth time.',
    },
    {
      id: 'clientB',
      label: 'Client B',
      role: 'Client (waits)',
      kind: 'client',
      x: 120,
      y: 340,
      description:
        'Arrives once every slot is already checked out. Its acquire() call is queued instead of rejected, and it eventually receives the next connection somebody else releases.',
    },
    {
      id: 'pool',
      label: 'ObjectPool<T>',
      role: 'Object Pool',
      kind: 'class',
      x: 400,
      y: 240,
      width: 170,
      description:
        'Owns a bounded set of T objects — here, PooledConnection — behind an idle list, an in-use set, and a FIFO queue of callers waiting for the next release(). It only knows T through the Poolable interface, so swapping in a different poolable type needs no change to the pool itself. Lazily creates new instances only up to maxSize.',
    },
    {
      id: 'poolable',
      label: 'Poolable',
      role: 'Reusable interface',
      kind: 'interface',
      x: 650,
      y: 100,
      description:
        'Declares reset() — the one thing the pool needs to be able to do to any pooled object before handing it to a new borrower, regardless of what else that object does.',
    },
    {
      id: 'connection',
      label: 'PooledConnection',
      role: 'Pooled Object',
      kind: 'class',
      x: 650,
      y: 240,
      width: 180,
      description:
        'The pooled object itself. Wraps a real, expensive resource and implements Poolable so the pool can scrub its state between borrowers without knowing its other details.',
    },
    {
      id: 'database',
      label: 'Database',
      role: 'External resource',
      kind: 'object',
      x: 650,
      y: 380,
      description:
        'The actual expensive resource underneath — a socket, file handle or similar — that makes constructing a PooledConnection costly enough to be worth pooling in the first place.',
    },
  ],
  relations: [
    {
      id: 'acquireA',
      from: 'clientA',
      to: 'pool',
      type: 'calls',
      label: 'acquire()',
      description:
        'Client A asks the pool for a connection. It never constructs one itself, and does not know in advance whether this will create, reuse, or queue.',
      bend: 20,
      code: 'acquire',
    },
    {
      id: 'createConn',
      from: 'pool',
      to: 'connection',
      type: 'creates',
      label: 'new PooledConnection()',
      description:
        'With no idle connection to reuse and room below maxSize, the pool lazily builds exactly one new PooledConnection and hands it straight to the caller.',
      bend: 25,
      code: 'acquire',
    },
    {
      id: 'connImplements',
      from: 'connection',
      to: 'poolable',
      type: 'implements',
      description: 'PooledConnection implements Poolable, so the pool can call reset() on it without knowing anything else about what a connection does.',
      bend: -15,
      code: 'connection',
    },
    {
      id: 'connWraps',
      from: 'connection',
      to: 'database',
      type: 'wraps',
      label: 'wraps',
      description: 'PooledConnection wraps one RawDatabaseSocket — the genuinely expensive thing being reused — behind a cheap-to-check-out interface.',
      bend: 15,
      code: 'connection',
    },
    {
      id: 'poolHolds',
      from: 'pool',
      to: 'connection',
      type: 'holds',
      label: 'idle: T[] / inUse: Set<T>',
      description: 'The pool holds every object it has ever created, sorted into idle and in-use, typed only as T extends Poolable — instead of losing track of them to the garbage collector.',
      bend: -25,
      code: 'pool',
    },
    {
      id: 'releaseA',
      from: 'clientA',
      to: 'pool',
      type: 'calls',
      label: 'release(conn)',
      description: 'A borrower calls release() when it is done, handing the connection back instead of discarding it.',
      bend: -20,
      code: 'release',
    },
    {
      id: 'acquireB',
      from: 'clientB',
      to: 'pool',
      type: 'calls',
      label: 'acquire()',
      description:
        'Client B calls acquire() while every connection is checked out. Because the pool is already at maxSize, this call is queued instead of creating a fourth connection.',
      bend: 20,
      code: 'acquire',
    },
    {
      id: 'handoffB',
      from: 'pool',
      to: 'clientB',
      type: 'notifies',
      label: 'resolve(conn)',
      description: "release() finds Client B waiting and resolves its pending acquire() directly with the freed connection — it never sits idle in between.",
      bend: -20,
      code: 'release',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'An empty pool',
      description:
        'ConnectionPool starts with nothing built: idle, inUse and waiting are all zero. No PooledConnection exists yet — the pool only creates one the first time somebody actually asks for it.',
      highlight: ['pool'],
      notes: { pool: 'idle:0 inUse:0 waiting:0' },
      code: 'pool',
    },
    {
      title: 'A client acquires — lazy creation',
      description:
        'Client A calls acquire(). There is nothing idle to reuse, but the pool is still below its max size of 3, so it lazily builds a brand-new PooledConnection instead of making Client A wait, and hands back a reference to it.',
      highlight: ['clientA', 'acquireA', 'createConn', 'connection'],
      packets: [
        { relation: 'acquireA', label: 'acquire()' },
        { relation: 'createConn', label: 'new PooledConnection()' },
        { relation: 'acquireA', label: '↩ conn', reverse: true },
      ],
      notes: { pool: 'idle:0 inUse:1 waiting:0' },
      code: 'acquire',
    },
    {
      title: 'The connection wraps the real resource',
      description:
        'PooledConnection implements Poolable and wraps one RawDatabaseSocket underneath. Client A only ever sees the pooled wrapper — never the raw socket it is built on.',
      highlight: ['connImplements', 'connWraps', 'poolable', 'database'],
      notes: { connection: 'wraps a socket' },
      code: 'connection',
    },
    {
      title: 'Client A releases it',
      description:
        "Client A calls release(conn). Nobody is waiting for a connection, so the pool resets it — clearing any open transaction — and returns it to the idle list instead of destroying it.",
      highlight: ['releaseA', 'connection'],
      packets: [{ relation: 'releaseA', label: 'release(conn)' }],
      notes: { pool: 'idle:1 inUse:0 waiting:0' },
      code: 'release',
    },
    {
      title: 'Three more acquires fill every slot',
      description:
        'Three more callers acquire connections of their own: the first reuses the idle connection, and the pool lazily creates two more to reach its max size of 3. Every slot is now busy.',
      highlight: ['pool', 'connection'],
      notes: { pool: 'idle:0 inUse:3 waiting:0' },
      code: 'acquire',
    },
    {
      title: 'A new caller arrives — the pool is exhausted',
      description:
        'Client B calls acquire(), but all 3 connections are in use and the pool is already at its max size. Instead of creating a fourth, acquire() queues Client B and returns a promise that stays pending.',
      highlight: ['clientB', 'acquireB', 'pool'],
      packets: [{ relation: 'acquireB', label: 'acquire()' }],
      notes: { pool: 'idle:0 inUse:3 waiting:1', clientB: 'waiting…' },
      code: 'acquire',
    },
    {
      title: 'Reset happens before the handoff',
      description:
        'One of the three borrowers calls release(conn). Before deciding where the connection goes next, release() calls reset() to clear whatever that borrower left behind — such as an open transaction — so no stale state can cross between callers.',
      highlight: ['releaseA', 'connection'],
      packets: [{ relation: 'releaseA', label: 'release(conn)' }],
      notes: { connection: 'reset' },
      code: 'reset',
    },
    {
      title: 'A release hands off instead of going idle',
      description:
        "Because Client B is waiting, the pool skips the idle list completely and resolves Client B's pending acquire() with this exact, already-reset connection.",
      highlight: ['releaseA', 'handoffB', 'connection'],
      packets: [{ relation: 'handoffB', label: 'resolve(conn)' }],
      notes: { pool: 'idle:0 inUse:3 waiting:0', clientB: 'acquired!' },
      code: 'release',
    },
    {
      title: 'Steady state: three connections, endlessly reused',
      description:
        'The pool never grows past the three PooledConnection objects it already built. Every later acquire()/release() cycle reuses one of those same three instances, no matter how many different callers pass through.',
      highlight: ['pool', 'poolHolds', 'connection'],
      notes: { pool: 'idle:0-3 inUse:0-3 waiting:0' },
      code: 'pool',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: `
// [database]
/** The expensive real resource being pooled — e.g. a raw DB/TCP socket. */
class RawDatabaseSocket {
  constructor(public readonly id: number) {}

  query(sql: string): void {
    console.log(\`socket#\${this.id} -> \${sql}\`)
  }
}
// [/database]

// [poolable]
interface Poolable {
  /** Clears any per-borrower state before the object is handed to someone new. */
  reset(): void
}
// [/poolable]

// [connection]
class PooledConnection implements Poolable {
  private txOpen = false

  constructor(private readonly socket: RawDatabaseSocket) {}

  query(sql: string): void {
    this.socket.query(sql)
  }

  beginTransaction(): void {
    this.txOpen = true
  }

  // [reset]
  reset(): void {
    this.txOpen = false // never leak an open transaction to the next borrower
  }
  // [/reset]
}
// [/connection]

// [pool]
class ObjectPool<T extends Poolable> {
  private readonly idle: T[] = []
  private readonly inUse = new Set<T>()
  private readonly waiting: Array<(item: T) => void> = []
  private created = 0

  constructor(
    private readonly factory: () => T,
    private readonly maxSize: number,
  ) {}

  // [acquire]
  acquire(): Promise<T> {
    const reused = this.idle.pop()
    if (reused) {
      this.inUse.add(reused)
      return Promise.resolve(reused)
    }
    if (this.created < this.maxSize) {
      const item = this.factory() // lazy creation — if this throws, no slot is used up
      this.created++ // only count it once the object actually exists
      this.inUse.add(item)
      return Promise.resolve(item)
    }
    // Every slot is taken: queue this request until a release() frees one up.
    return new Promise((resolve) => this.waiting.push(resolve))
  }
  // [/acquire]

  // [release]
  release(item: T): void {
    if (!this.inUse.delete(item)) {
      throw new Error('release() called with an item that is not checked out from this pool')
    }
    item.reset() // scrub borrower state before anyone else sees this object
    const next = this.waiting.shift()
    if (next) {
      this.inUse.add(item)
      next(item) // hand it straight to the waiting caller — it never goes idle
    } else {
      this.idle.push(item)
    }
  }
  // [/release]

  get stats() {
    return { idle: this.idle.length, inUse: this.inUse.size, waiting: this.waiting.length }
  }
}
// [/pool]

// [usage]
const pool = new ObjectPool<PooledConnection>(() => new PooledConnection(new RawDatabaseSocket(Date.now())), 3)

// [clientA]
const connA = await pool.acquire() // pool is empty — lazily creates connection #1
connA.query('SELECT 1')
pool.release(connA) // reset, then back to idle (or straight to a waiter)
// [/clientA]

// [clientB]
// Fill every slot (maxSize = 3), then watch a caller queue and get served:
const [c1, c2, c3] = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()])
c2.query('SELECT 2')
c3.query('SELECT 3')

const pending = pool.acquire() // queued: every slot is already checked out
pool.release(c1) // handed straight to the queued caller instead of going idle
const c4 = await pending // c4 === c1, reused rather than freshly constructed
// [/clientB]
// [/usage]
`,

  Visualization: ObjectPoolVisualization,
}
