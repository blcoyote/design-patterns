// --- Write side -------------------------------------------------------

interface PlaceOrderCommand {
  type: 'PlaceOrder'
  orderId: string
  customerId: string
  totalCents: number
}

// [aggregate]
class Order {
  status: 'placed' | 'shipped' = 'placed'

  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly totalCents: number,
  ) {}
}
// [/aggregate]

interface WriteStore {
  save(order: Order): void
}

// [writeStore]
class SqlWriteStore implements WriteStore {
  private rows = new Map<string, Order>()

  save(order: Order): void {
    this.rows.set(order.id, order)
    console.log(`WRITE DB: upserted order ${order.id}`)
  }
}
// [/writeStore]

// [dispatcher]
type Command = PlaceOrderCommand

class CommandDispatcher {
  private handlers = new Map<Command['type'], (command: Command) => void>()

  register<T extends Command>(type: T['type'], handler: (command: T) => void): void {
    this.handlers.set(type, handler as (command: Command) => void)
  }

  dispatch(command: Command): void {
    const handler = this.handlers.get(command.type)
    if (!handler) throw new Error(`no handler registered for ${command.type}`)
    handler(command)
  }
}
// [/dispatcher]

// [commandHandler]
class PlaceOrderHandler {
  constructor(
    private writeStore: WriteStore,
    private projector: Projector,
  ) {}

  handle(command: PlaceOrderCommand): void {
    const order = new Order(command.orderId, command.customerId, command.totalCents)
    this.writeStore.save(order)
    // In a real system the projector would pick this up off a queue, a CDC
    // stream or a cron job — asynchronously, on its own schedule. Here that
    // queue is modeled explicitly: enqueuing is instant, but nothing is
    // projected into the read store until something calls projector.catchUp().
    this.projector.enqueue(order)
  }
}
// [/commandHandler]

// --- Read side ----------------------------------------------------------

interface OrderSummaryView {
  orderId: string
  customerId: string
  totalDisplay: string
  status: string
}

interface ReadStore {
  upsert(view: OrderSummaryView): void
  find(orderId: string): OrderSummaryView | undefined
}

// [readStore]
class InMemoryReadStore implements ReadStore {
  private views = new Map<string, OrderSummaryView>()

  upsert(view: OrderSummaryView): void {
    this.views.set(view.orderId, view)
  }

  find(orderId: string): OrderSummaryView | undefined {
    return this.views.get(orderId)
  }
}
// [/readStore]

// [projector]
class Projector {
  private queue: Order[] = []

  constructor(private readStore: ReadStore) {}

  // Schedules a projection. Stands in for a message landing on a real queue.
  enqueue(order: Order): void {
    this.queue.push(order)
  }

  // Drains the queue, turning each pending write-model change into the
  // denormalised read shape. Calling this is the deterministic stand-in for
  // "enough time has passed for the projector to have run".
  catchUp(): void {
    for (const order of this.queue) {
      const view: OrderSummaryView = {
        orderId: order.id,
        customerId: order.customerId,
        totalDisplay: `$${(order.totalCents / 100).toFixed(2)}`,
        status: order.status,
      }
      this.readStore.upsert(view)
      console.log(`READ DB: projected order ${view.orderId}`)
    }
    this.queue = []
  }
}
// [/projector]

// [queryHandler]
class GetOrderSummaryHandler {
  constructor(private readStore: ReadStore) {}

  handle(orderId: string): OrderSummaryView | undefined {
    return this.readStore.find(orderId)
  }
}
// [/queryHandler]

// --- Usage: command then an immediate query, to surface the lag ---------

// [usage]
const writeStore = new SqlWriteStore()
const readStore = new InMemoryReadStore()
const projector = new Projector(readStore)
const placeOrderHandler = new PlaceOrderHandler(writeStore, projector)
const getOrderSummary = new GetOrderSummaryHandler(readStore)

const dispatcher = new CommandDispatcher()
dispatcher.register<PlaceOrderCommand>('PlaceOrder', (command) => placeOrderHandler.handle(command))

dispatcher.dispatch({ type: 'PlaceOrder', orderId: 'order-9', customerId: 'cust-42', totalCents: 4998 })
// [/usage]

// [eventualConsistency]
function formatView(view: OrderSummaryView | undefined): string {
  return view ? `${view.orderId} ${view.customerId} ${view.totalDisplay} ${view.status}` : '(none yet)'
}

// Querying immediately after the command returns misses the projection: the
// write succeeded, but nothing has drained the projector's queue yet.
console.log('query right after dispatch:', formatView(getOrderSummary.handle('order-9')))

projector.catchUp()

console.log('query after the projector has run:', formatView(getOrderSummary.handle('order-9')))
// [/eventualConsistency]
