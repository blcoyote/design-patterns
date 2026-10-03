// --- Shared pipeline infrastructure --------------------------------------
// Everything in this section is cross-cutting infrastructure: it belongs to
// no single slice, and every slice is routed through the same instance.
// PlaceOrderCommand and GetOrderQuery are declared further down, inside their
// own slice's region — this is a forward reference, which is safe in
// TypeScript because interfaces live entirely in type space and are resolved
// regardless of where in the file they are declared.

type Request = PlaceOrderCommand | GetOrderQuery
type Next = () => unknown

interface PipelineBehaviour {
  handle(request: Request, next: Next): unknown
}

// [mediator]
class Mediator {
  private handlers = new Map<Request['type'], (request: Request) => unknown>()
  private behaviours: PipelineBehaviour[] = []

  registerHandler<T extends Request>(type: T['type'], handler: (request: T) => unknown): void {
    this.handlers.set(type, handler as (request: Request) => unknown)
  }

  // Behaviours run in registration order, outermost first: the first behaviour
  // registered wraps everything after it, including every other behaviour.
  use(behaviour: PipelineBehaviour): void {
    this.behaviours.push(behaviour)
  }

  send<TResponse>(request: Request): TResponse {
    const handler = this.handlers.get(request.type)
    if (!handler) throw new Error(`no handler registered for ${request.type}`)

    const pipeline = this.behaviours.reduceRight<Next>(
      (next, behaviour) => () => behaviour.handle(request, next),
      () => handler(request),
    )
    return pipeline() as TResponse
  }
}
// [/mediator]

// [loggingBehaviour]
class LoggingBehaviour implements PipelineBehaviour {
  handle(request: Request, next: Next): unknown {
    console.log(`LOG: handling ${request.type}`)
    // If next() throws (a behaviour further down the chain rejected the
    // request), this line never runs — the exception propagates straight
    // through, and "LOG: handled" never prints.
    const result = next()
    console.log(`LOG: handled ${request.type}`)
    return result
  }
}
// [/loggingBehaviour]

// [validationBehaviour]
class ValidationBehaviour implements PipelineBehaviour {
  handle(request: Request, next: Next): unknown {
    // A behaviour that does not call next() short-circuits the chain: no
    // behaviour after it, and no handler, ever runs for this request. Note
    // that LoggingBehaviour runs before this one, so it has already logged
    // "handling" by the time a request gets rejected here.
    if (request.type === 'PlaceOrder' && request.totalCents <= 0) {
      throw new Error('PlaceOrder requires a positive totalCents')
    }
    if (request.type === 'GetOrder' && !request.orderId) {
      throw new Error('GetOrder requires an orderId')
    }
    return next()
  }
}
// [/validationBehaviour]

// --- Shared table ---------------------------------------------------------
// Vertical slices commonly still share one physical table; what makes each
// slice "self-contained" is that it owns its own narrow data-access code on
// top of that table, not that the bytes are never shared.

interface OrderRow {
  orderId: string
  customerId: string
  totalCents: number
}

// [ordersTable]
class OrdersTable {
  private rows = new Map<string, OrderRow>()

  insert(row: OrderRow): void {
    this.rows.set(row.orderId, row)
  }

  selectById(orderId: string): OrderRow | undefined {
    return this.rows.get(orderId)
  }
}
// [/ordersTable]

// --- PlaceOrder slice -------------------------------------------------------
// This slice's request type, handler and data access, together. Nothing
// outside this slice needs to know PlaceOrderCommand exists.

// [placeOrderStore]
class PlaceOrderStore {
  constructor(private table: OrdersTable) {}

  save(row: OrderRow): void {
    this.table.insert(row)
    console.log(`PlaceOrder slice: saved order ${row.orderId}`)
  }
}
// [/placeOrderStore]

// [placeOrderHandler]
interface PlaceOrderCommand {
  type: 'PlaceOrder'
  orderId: string
  customerId: string
  totalCents: number
}

class PlaceOrderHandler {
  constructor(private store: PlaceOrderStore) {}

  handle(command: PlaceOrderCommand): { orderId: string } {
    this.store.save({ orderId: command.orderId, customerId: command.customerId, totalCents: command.totalCents })
    return { orderId: command.orderId }
  }
}
// [/placeOrderHandler]

// --- GetOrder slice ---------------------------------------------------------
// A completely separate request type, handler and data access — it shares no
// code with the PlaceOrder slice above except the Mediator and the pipeline.

// [getOrderStore]
class GetOrderStore {
  constructor(private table: OrdersTable) {}

  findById(orderId: string): OrderRow | undefined {
    return this.table.selectById(orderId)
  }
}
// [/getOrderStore]

// [getOrderHandler]
interface GetOrderQuery {
  type: 'GetOrder'
  orderId: string
}

class GetOrderHandler {
  constructor(private store: GetOrderStore) {}

  handle(query: GetOrderQuery): OrderRow {
    const row = this.store.findById(query.orderId)
    if (!row) throw new Error(`no order found for ${query.orderId}`)
    return row
  }
}
// [/getOrderHandler]

// --- Usage: a command through the pipeline, a query through the same one,
// and a second, invalid command to show the pipeline rejecting it ----------

// [usage]
const table = new OrdersTable()

const mediator = new Mediator()
mediator.use(new LoggingBehaviour())
mediator.use(new ValidationBehaviour())

const placeOrderHandler = new PlaceOrderHandler(new PlaceOrderStore(table))
const getOrderHandler = new GetOrderHandler(new GetOrderStore(table))

mediator.registerHandler<PlaceOrderCommand>('PlaceOrder', (request) => placeOrderHandler.handle(request))
mediator.registerHandler<GetOrderQuery>('GetOrder', (request) => getOrderHandler.handle(request))

mediator.send<{ orderId: string }>({ type: 'PlaceOrder', orderId: 'order-7', customerId: 'cust-11', totalCents: 2500 })

const order = mediator.send<OrderRow>({ type: 'GetOrder', orderId: 'order-7' })
console.log(`GetOrder result: ${order.orderId} ${order.customerId} $${(order.totalCents / 100).toFixed(2)}`)

// This PlaceOrder has totalCents: 0. LoggingBehaviour still logs "handling"
// first — it runs before ValidationBehaviour in the pipeline — but
// ValidationBehaviour then throws instead of calling next(), so
// PlaceOrderHandler never runs (no "saved" line) and LoggingBehaviour's
// "handled" line never prints either.
try {
  mediator.send<{ orderId: string }>({ type: 'PlaceOrder', orderId: 'order-8', customerId: 'cust-12', totalCents: 0 })
} catch (error) {
  console.log(`rejected: ${(error as Error).message}`)
}
// [/usage]
