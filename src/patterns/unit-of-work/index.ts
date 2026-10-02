import type { PatternDefinition } from '@/types/pattern'
import { UnitOfWorkVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'unit-of-work',
  name: 'Unit of Work',
  category: 'architectural',
  order: 3,
  summary: 'Collect every insert, update and delete from a business operation, then flush them to the database together — or not at all.',
  intent:
    'Track every object created, changed, or deleted during a business transaction, and coordinate writing out all of those changes as a single unit — so either all of them persist, or none do.',
  problem:
    'A checkout operation touches half a dozen rows: a new Order is inserted, the Customer\'s loyalty points are updated, a stale Cart is deleted. Saving each of those the instant it changes means a crash halfway through leaves the database in a state no business rule allows — an Order with no matching Cart cleanup, points awarded for a purchase that never actually completed. Nothing holds the whole operation together, and every write is also its own round trip to the database.',
  solution:
    'Give each business operation a UnitOfWork. Instead of saving anything the moment it changes, application code just reports what happened — registerNew, registerDirty, registerRemoved — and the UnitOfWork keeps each object in the right pending list. Only when the caller calls commit() does it open a single database transaction, flush every pending insert, update and delete through it, and commit. If any single write fails, the whole transaction rolls back and none of the changes take effect.',
  analogy:
    'A restaurant order pad: a server does not walk to the kitchen after jotting down each item — they collect the whole table\'s order first, then send it in as one ticket. If the kitchen cannot make one of the dishes, the whole ticket is handed back rather than half the meal silently never arriving.',
  whenToUse: [
    'A single business operation touches several objects that must be saved together or not at all.',
    'You want to batch a flurry of small writes into one round trip instead of one query per change.',
    'You need one place to decide the order writes happen in (inserts before updates before deletes, say) independent of when the application code made each change.',
  ],
  pros: [
    'Changes commit as one atomic transaction — a partial failure leaves no partial state behind.',
    'Batches many small writes into a single round trip instead of a query per change.',
    'Decouples "what changed", tracked by the UnitOfWork as it happens, from "when it gets written", decided once by commit().',
  ],
  cons: [
    'Adds bookkeeping — every mutation has to be registered instead of just saved directly.',
    'A long-lived Unit of Work can accumulate large pending lists and hold locks or memory longer than it should.',
    'Easy to forget to register a change, which produces a silent write that never actually happens.',
  ],
  realWorld: [
    'Entity Framework Core\'s DbContext — SaveChanges() flushes every tracked Added/Modified/Deleted entity in one transaction.',
    'Hibernate / NHibernate\'s Session, which batches inserts, updates and deletes and flushes them together.',
    'SQLAlchemy\'s Session object, which tracks pending objects until session.commit().',
    'Martin Fowler\'s Patterns of Enterprise Application Architecture, which names and formalizes this pattern.',
  ],
  related: ['repository', 'command', 'memento'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'client',
      label: 'Client',
      role: 'Application code',
      kind: 'client',
      x: 100,
      y: 130,
      width: 130,
      description:
        'Runs one business operation. It never issues SQL directly — it just tells the UnitOfWork what it did (registerNew/Dirty/Removed), then calls commit() once the operation is complete.',
    },
    {
      id: 'unitOfWork',
      label: 'UnitOfWork',
      role: 'Unit of Work',
      kind: 'class',
      x: 340,
      y: 130,
      width: 170,
      description:
        'Keeps three lists — newObjects, dirtyObjects, removedObjects — and fills them as the client registers changes. commit() opens one transaction, flushes every pending write through it in order, and clears the lists only if the transaction succeeds.',
    },
    {
      id: 'database',
      label: 'Database',
      role: 'Data store',
      kind: 'class',
      x: 680,
      y: 130,
      width: 150,
      description:
        'Executes the actual BEGIN, INSERT/UPDATE/DELETE and COMMIT or ROLLBACK statements. It has no idea these writes were batched — from its side, commit() just looks like one ordinary transaction.',
    },
    {
      id: 'pendingNew',
      label: 'newObjects[]',
      role: 'New list',
      kind: 'object',
      x: 170,
      y: 330,
      width: 140,
      description: 'Objects created during this operation that have never been saved. commit() will INSERT each one.',
    },
    {
      id: 'pendingDirty',
      label: 'dirtyObjects[]',
      role: 'Dirty list',
      kind: 'object',
      x: 400,
      y: 330,
      width: 150,
      description:
        'Previously-saved objects that were modified. registerDirty() only adds an object here if it is not already tracked as new or dirty, so repeated edits do not queue repeated UPDATEs.',
    },
    {
      id: 'pendingRemoved',
      label: 'removedObjects[]',
      role: 'Removed list',
      kind: 'object',
      x: 630,
      y: 330,
      width: 150,
      description:
        'Objects marked for deletion. registerRemoved() also strips the object out of the new/dirty lists first — there is no point inserting or updating something you are about to delete.',
    },
  ],
  relations: [
    {
      id: 'register',
      from: 'client',
      to: 'unitOfWork',
      type: 'calls',
      label: 'register*()',
      description:
        'The client reports every creation, change and deletion as it happens during the operation. The UnitOfWork only files the object away — it does not touch the database yet.',
      code: 'register',
      bend: -22,
    },
    {
      id: 'commitCall',
      from: 'client',
      to: 'unitOfWork',
      type: 'calls',
      label: 'commit()',
      description: 'Once the business operation is logically complete, the client calls commit() exactly once to flush everything that was registered.',
      code: 'commit',
      bend: 22,
    },
    {
      id: 'uowNew',
      from: 'unitOfWork',
      to: 'pendingNew',
      type: 'holds',
      label: 'newObjects',
      description: 'The UnitOfWork owns this list directly — nothing outside it ever reads or writes newObjects[] itself.',
      code: 'pendingNew',
      bend: -12,
    },
    {
      id: 'uowDirty',
      from: 'unitOfWork',
      to: 'pendingDirty',
      type: 'holds',
      label: 'dirtyObjects',
      description: 'The second of the three pending lists, filled by registerDirty().',
      code: 'pendingDirty',
    },
    {
      id: 'uowRemoved',
      from: 'unitOfWork',
      to: 'pendingRemoved',
      type: 'holds',
      label: 'removedObjects',
      description: 'The third pending list, filled by registerRemoved() — and the one commit() flushes last.',
      code: 'pendingRemoved',
      bend: 12,
    },
    {
      id: 'flush',
      from: 'unitOfWork',
      to: 'database',
      type: 'calls',
      label: 'BEGIN … COMMIT',
      description:
        'commit() wraps every pending insert, update and delete in a single database transaction. If every write succeeds the transaction commits; if any one of them throws, the UnitOfWork rolls the whole thing back instead.',
      code: 'commit',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'A new Order is created',
      description:
        'Inside a single checkout operation, the application constructs a new Order and calls uow.registerNew(order). The UnitOfWork does not touch the database — it just files the object under its pending "new" list.',
      highlight: ['client', 'register', 'unitOfWork', 'uowNew', 'pendingNew'],
      packets: [{ relation: 'register', label: 'registerNew(order)' }],
      notes: { unitOfWork: 'new: 1' },
      code: 'registerNew',
    },
    {
      title: 'An existing Customer is modified',
      description:
        'The same operation updates the Customer\'s loyalty points in memory and calls uow.registerDirty(customer). It is filed under "dirty" — still nothing has been written to the database.',
      highlight: ['client', 'register', 'unitOfWork', 'uowDirty', 'pendingDirty'],
      packets: [{ relation: 'register', label: 'registerDirty(customer)' }],
      notes: { unitOfWork: 'dirty: 1' },
      code: 'registerDirty',
    },
    {
      title: 'A stale Cart is deleted',
      description:
        'The now-emptied Cart is marked for deletion with uow.registerRemoved(cart). It moves to the "removed" list — again, no DELETE has reached the database yet.',
      highlight: ['client', 'register', 'unitOfWork', 'uowRemoved', 'pendingRemoved'],
      packets: [{ relation: 'register', label: 'registerRemoved(cart)' }],
      notes: { unitOfWork: 'removed: 1' },
      code: 'registerRemoved',
    },
    {
      title: 'A duplicate registration is ignored',
      description:
        'Something elsewhere in the operation calls registerDirty(customer) again. registerDirty checks both the new and dirty lists first, so the Customer is not queued twice — commit() will still only update it once.',
      highlight: ['unitOfWork', 'uowDirty', 'pendingDirty'],
      notes: { unitOfWork: 'dirty: 1 (unchanged)' },
      code: 'registerDirty',
    },
    {
      title: 'commit() opens a transaction',
      description:
        'The client calls uow.commit(). The UnitOfWork does not flush object by object — it opens one database transaction first, so every pending write can succeed or fail together as a single unit.',
      highlight: ['client', 'commitCall', 'unitOfWork', 'flush', 'database'],
      packets: [{ relation: 'commitCall', label: 'commit()' }],
      notes: { database: 'BEGIN' },
      code: 'commit',
    },
    {
      title: 'Every pending change flushes together',
      description:
        'Inside that one transaction, the UnitOfWork inserts the new Order, updates the Customer, and deletes the Cart — in that order — all through the same connection.',
      highlight: ['unitOfWork', 'pendingNew', 'pendingDirty', 'pendingRemoved', 'flush', 'database'],
      packets: [{ relation: 'flush', label: 'INSERT/UPDATE/DELETE' }],
      notes: { database: '3 writes pending' },
      code: 'commit',
    },
    {
      title: 'COMMIT succeeds',
      description:
        'All three writes succeeded, so the transaction commits. The UnitOfWork clears its new/dirty/removed lists — there is nothing left to flush until the next business operation registers more changes.',
      highlight: ['unitOfWork', 'flush', 'database'],
      packets: [{ relation: 'flush', label: 'COMMIT', reverse: true }],
      notes: { unitOfWork: 'cleared', database: 'COMMIT ✓' },
      code: 'commit',
    },
    {
      title: 'A different commit fails — and rolls back',
      description:
        'In another operation, the UPDATE to a Customer violates a constraint partway through the flush. The UnitOfWork catches the failure, issues ROLLBACK instead of COMMIT, and the database ends up exactly as it was — the Order insert and Cart delete from the same batch are undone right along with it.',
      highlight: ['unitOfWork', 'flush', 'database'],
      packets: [{ relation: 'flush', label: 'ROLLBACK', reverse: true }],
      notes: { unitOfWork: 'pending restored', database: 'ROLLBACK ✗' },
      code: 'commit',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: `
interface Entity {
  id: string
}

interface Database {
  beginTransaction(): void
  insert(entity: Entity): void
  update(entity: Entity): void
  delete(entity: Entity): void
  commitTransaction(): void
  rollbackTransaction(): void
}

// [database]
class SqlDatabase implements Database {
  beginTransaction() {
    console.log('BEGIN')
  }
  insert(entity: Entity) {
    console.log(\`INSERT \${entity.id}\`)
  }
  update(entity: Entity) {
    console.log(\`UPDATE \${entity.id}\`)
  }
  delete(entity: Entity) {
    console.log(\`DELETE \${entity.id}\`)
  }
  commitTransaction() {
    console.log('COMMIT')
  }
  rollbackTransaction() {
    console.log('ROLLBACK')
  }
}
// [/database]

// [unitOfWork]
class UnitOfWork {
  // [pendingNew]
  private newObjects: Entity[] = []
  // [/pendingNew]
  // [pendingDirty]
  private dirtyObjects: Entity[] = []
  // [/pendingDirty]
  // [pendingRemoved]
  private removedObjects: Entity[] = []
  // [/pendingRemoved]

  constructor(private db: Database) {}

  // [register]
  // [registerNew]
  registerNew(entity: Entity) {
    this.newObjects.push(entity)
  }
  // [/registerNew]

  // [registerDirty]
  registerDirty(entity: Entity) {
    const alreadyTracked = this.newObjects.includes(entity) || this.dirtyObjects.includes(entity)
    if (!alreadyTracked) this.dirtyObjects.push(entity)
  }
  // [/registerDirty]

  // [registerRemoved]
  registerRemoved(entity: Entity) {
    // Never made it to the db, or no longer needs to — either way, drop it from the other lists.
    this.newObjects = this.newObjects.filter((e) => e !== entity)
    this.dirtyObjects = this.dirtyObjects.filter((e) => e !== entity)
    this.removedObjects.push(entity)
  }
  // [/registerRemoved]
  // [/register]

  // [commit]
  commit() {
    this.db.beginTransaction()
    try {
      for (const entity of this.newObjects) this.db.insert(entity)
      for (const entity of this.dirtyObjects) this.db.update(entity)
      for (const entity of this.removedObjects) this.db.delete(entity)
      this.db.commitTransaction()
      this.newObjects = []
      this.dirtyObjects = []
      this.removedObjects = []
    } catch (err) {
      this.db.rollbackTransaction() // none of the writes above take effect
      throw err
    }
  }
  // [/commit]
}
// [/unitOfWork]

// [client]
const db = new SqlDatabase()
const uow = new UnitOfWork(db)

const order = { id: 'order-104' }
const customer = { id: 'customer-58' }
const cart = { id: 'cart-9' }

uow.registerNew(order)
uow.registerDirty(customer)
uow.registerRemoved(cart)
uow.registerDirty(customer) // already tracked — ignored

uow.commit()
// BEGIN
// INSERT order-104
// UPDATE customer-58
// DELETE cart-9
// COMMIT
// [/client]
`,
  Visualization: UnitOfWorkVisualization,
}
