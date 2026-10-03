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
    console.log(`INSERT ${entity.id}`)
  }
  update(entity: Entity) {
    console.log(`UPDATE ${entity.id}`)
  }
  delete(entity: Entity) {
    console.log(`DELETE ${entity.id}`)
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
  // Note: entities are tracked by reference (Array.includes uses ===), so the
  // very same object instance must be passed to every register*() call for an
  // entity. Real Unit of Work implementations pair this with an Identity Map
  // so a given row only ever has one in-memory instance to begin with.

  // [registerNew]
  registerNew(entity: Entity) {
    // Guards against double-registering the same still-unsaved entity as new.
    if (!this.newObjects.includes(entity)) this.newObjects.push(entity)
  }
  // [/registerNew]

  // [registerDirty]
  registerDirty(entity: Entity) {
    // Skips entities already queued as new (nothing to UPDATE yet) or already
    // marked dirty (no point queuing the same UPDATE twice).
    const alreadyTracked = this.newObjects.includes(entity) || this.dirtyObjects.includes(entity)
    if (!alreadyTracked) this.dirtyObjects.push(entity)
  }
  // [/registerDirty]

  // [registerRemoved]
  registerRemoved(entity: Entity) {
    const wasNew = this.newObjects.includes(entity)
    // Whatever it was before, there is nothing left to insert or update.
    this.newObjects = this.newObjects.filter((e) => e !== entity)
    this.dirtyObjects = this.dirtyObjects.filter((e) => e !== entity)
    // A row that was never inserted has nothing to delete.
    if (!wasNew && !this.removedObjects.includes(entity)) this.removedObjects.push(entity)
  }
  // [/registerRemoved]
  // [/register]

  // [commit]
  commit() {
    this.db.beginTransaction()
    try {
      // One statement per entity, in order: this example trades round trips
      // for simplicity. The atomicity guarantee comes from the single
      // transaction wrapping all of them, not from how many statements it took
      // to get there — a real ORM can batch these into fewer round trips.
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
