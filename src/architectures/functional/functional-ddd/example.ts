// [result]
// Errors are values. A step that can fail returns a Result instead of throwing, so the
// possibility of failure is visible in the type and the caller has to deal with it.
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(error: string): Result<T> {
  return { ok: false, error };
}

// bind is the railway switch: on Ok it runs the next step with the value, on Err it
// skips the step and passes the same error along. Chaining binds is "railway-oriented
// programming" — the first Err short-circuits everything after it.
function bind<T, U>(result: Result<T>, next: (value: T) => Result<U>): Result<U> {
  return result.ok ? next(result.value) : { ok: false, error: result.error };
}
// [/result]

// [money]
/** Value object as plain data: no methods, no hidden state. Equal fields mean equal money. */
interface Money {
  readonly cents: number;
  readonly currency: string;
}

// Rounds half away from zero, the same way as the OO version's Money.of.
function money(amount: number, currency = "USD"): Money {
  const scaled = amount * 100;
  const cents = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
  return { cents, currency };
}

function addMoney(a: Money, b: Money): Money {
  // Adding two currencies is a programmer bug, not a domain outcome: no business
  // process "fails" this way, so it is thrown (Wlaschin: errors you model vs. panics).
  if (a.currency !== b.currency) throw new Error("currency mismatch");
  return { cents: a.cents + b.cents, currency: a.currency };
}

function formatMoney(m: Money): string {
  return `${(m.cents / 100).toFixed(2)} ${m.currency}`;
}
// [/money]

// [orderLine]
// Value object as plain data, meant to be created only through createOrderLine. That is
// a convention: OrderLine is a structural interface, so any code can still write
// { sku, unitPrice, quantity: 0 } directly.
interface OrderLine {
  readonly sku: string;
  readonly unitPrice: Money;
  readonly quantity: number;
}

// Smart constructor: the one place an OrderLine is meant to be built. As long as code goes
// through it, an invalid line never reaches the rest of the model. The failure comes back
// as a value, not an exception.
function createOrderLine(sku: string, unitPrice: Money, quantity: number): Result<OrderLine> {
  if (quantity < 1) return err(`invalid line ${sku}: quantity must be at least 1`);
  return ok({ sku, unitPrice, quantity });
}

function lineTotal(line: OrderLine): Money {
  let total = money(0, line.unitPrice.currency);
  for (let i = 0; i < line.quantity; i++) total = addMoney(total, line.unitPrice);
  return total;
}
// [/orderLine]

// [order]
// Type-state: an order is either a draft or placed, and the two are different types.
// Only a PlacedOrder has a total, so "total of a draft" cannot even be written.
// Every field is readonly: a transition builds a new value and leaves the old one alone.
interface DraftOrder {
  readonly kind: "draft";
  readonly id: string;
  readonly customerId: string;
  readonly lines: readonly OrderLine[];
}

interface PlacedOrder {
  readonly kind: "placed";
  readonly id: string;
  readonly customerId: string;
  readonly lines: readonly OrderLine[];
  readonly total: Money;
}

type Order = DraftOrder | PlacedOrder;

// Factory function: an order always starts as an empty draft.
function createDraft(id: string, customerId: string): DraftOrder {
  return { kind: "draft", id, customerId, lines: [] };
}
// [/order]

// [orderPlaced]
// Domain event as plain data. It carries no timestamp: the imperative shell would
// stamp the time, which keeps the core pure (no clock reads).
interface OrderPlaced {
  readonly kind: "OrderPlaced";
  readonly orderId: string;
  readonly customerId: string;
  readonly total: Money;
}

type OrderEvent = OrderPlaced;
// [/orderPlaced]

// [rules]
// Business rules as pure functions: each takes values and returns new values. None of
// them mutates its input or performs I/O.

// Strategy as a function type: a policy is just a function from a draft to a Result.
type OrderPolicy = (order: DraftOrder) => Result<DraftOrder>;

const requireAtLeastOneLine: OrderPolicy = (order) =>
  order.lines.length > 0
    ? ok(order)
    : err(`cannot place order ${order.id}: an order needs at least one line to be placed`);

interface PlaceOrderOutcome {
  readonly order: PlacedOrder;
  readonly events: readonly OrderEvent[];
}

function addLine(order: Order, line: OrderLine): Result<DraftOrder> {
  switch (order.kind) {
    case "draft":
      // A new draft: the old lines are copied into a new array, never pushed onto.
      return ok({ ...order, lines: [...order.lines, line] });
    case "placed":
      // The invariant: a placed order cannot grow. It comes back as an Err value.
      return err(`cannot add a line to order ${order.id}: already placed`);
  }
}

function place(order: Order, policy: OrderPolicy): Result<PlaceOrderOutcome> {
  switch (order.kind) {
    case "placed":
      return err(`order ${order.id} is already placed`);
    case "draft":
      return bind(policy(order), (accepted) => {
        // Fold the line totals into one Money.
        const total = accepted.lines.reduce(
          (sum, line) => addMoney(sum, lineTotal(line)),
          money(0),
        );
        const placed: PlacedOrder = {
          kind: "placed",
          id: accepted.id,
          customerId: accepted.customerId,
          lines: accepted.lines,
          total,
        };
        // The event is returned alongside the new order. Nothing is stored or published here.
        const placedEvent: OrderPlaced = {
          kind: "OrderPlaced",
          orderId: placed.id,
          customerId: placed.customerId,
          total: placed.total,
        };
        return ok({ order: placed, events: [placedEvent] });
      });
  }
}
// [/rules]

// [workflow]
// The input as it arrives from outside: raw, unvalidated numbers and strings.
interface UnvalidatedLine {
  readonly sku: string;
  readonly price: number;
  readonly quantity: number;
}

interface PlaceOrderCommand {
  readonly orderId: string;
  readonly lines: readonly UnvalidatedLine[];
}

// The use case as one pure function: (order, command, policy) in, Result out. It
// validates each raw line (createOrderLine), adds it (addLine), then places the order.
// Each step is chained with bind, so the first Err skips every later step.
// No I/O: loading the order and storing the result are the handler's job.
function placeOrderWorkflow(
  order: Order,
  cmd: PlaceOrderCommand,
  policy: OrderPolicy,
): Result<PlaceOrderOutcome> {
  const withLines = cmd.lines.reduce<Result<Order>>(
    (acc, raw) =>
      bind(acc, (current) =>
        bind(createOrderLine(raw.sku, money(raw.price), raw.quantity), (line) =>
          addLine(current, line),
        ),
      ),
    ok(order),
  );
  return bind(withLines, (current) => place(current, policy));
}
// [/workflow]

// [orderStore]
// Repository as a record of functions instead of an interface with a class behind it.
type LoadOrder = (id: string) => Order | undefined;
type SaveOrder = (order: Order) => void;

interface OrderStore {
  readonly load: LoadOrder;
  readonly save: SaveOrder;
}

// The in-memory adapter: the two functions close over a Map. Saving replaces whatever
// was stored under that id.
function inMemoryOrderStore(): OrderStore {
  const orders = new Map<string, Order>();
  return {
    load: (id) => orders.get(id),
    save: (order) => {
      orders.set(order.id, order);
    },
  };
}
// [/orderStore]

// [shipping]
// Shipping bounded context: its own vocabulary. It has never heard of an "Order" or
// of OrderPlaced.
interface ShipmentRequested {
  readonly kind: "ShipmentRequested";
  readonly shipmentId: string;
  readonly recipientId: string;
  readonly value: Money;
}

// A side effect, so it lives in the shell, not in the pure core.
function requestShipment(event: ShipmentRequested): void {
  console.log(
    `[shipping] shipment ${event.shipmentId} requested for ${event.recipientId}, value ${formatMoney(event.value)}`,
  );
}
// [/shipping]

// [acl]
// Anti-Corruption Layer as a pure function: translates Ordering's OrderPlaced into
// Shipping's own ShipmentRequested, so Ordering's model never leaks into Shipping.
// It only builds a new value; delivering it is the handler's job.
function toShipmentRequested(event: OrderPlaced): ShipmentRequested {
  return {
    kind: "ShipmentRequested",
    shipmentId: `ship-${event.orderId}`,
    recipientId: event.customerId,
    value: event.total,
  };
}
// [/acl]

// [handler]
// Dependencies are plain functions. They are handed over once, when the handler is built.
interface PlaceOrderDeps {
  readonly load: LoadOrder;
  readonly save: SaveOrder;
  readonly publish: (event: ShipmentRequested) => void;
  readonly policy: OrderPolicy;
}

// The imperative shell: I/O at the edges, the pure workflow in the middle. The
// dependencies reach it through a closure (partial application), not a constructor.
// Order: load (I/O), run the pure workflow, on Ok save (I/O), then publish each event.
function makePlaceOrderHandler(
  deps: PlaceOrderDeps,
): (cmd: PlaceOrderCommand) => Result<PlacedOrder> {
  return (cmd) => {
    const existing = deps.load(cmd.orderId);
    if (existing === undefined) return err(`no such order: ${cmd.orderId}`);

    const result = placeOrderWorkflow(existing, cmd, deps.policy);
    if (!result.ok) return { ok: false, error: result.error };

    deps.save(result.value.order);
    for (const event of result.value.events) {
      switch (event.kind) {
        case "OrderPlaced":
          deps.publish(toShipmentRequested(event));
          break;
      }
    }
    return ok(result.value.order);
  };
}
// [/handler]

// Usage
const store = inMemoryOrderStore();
const handlePlaceOrder = makePlaceOrderHandler({
  load: store.load,
  save: store.save,
  publish: requestShipment,
  policy: requireAtLeastOneLine,
});

const draft = createDraft("order-1", "cust-42");
store.save(draft);

const placeResult = handlePlaceOrder({
  orderId: "order-1",
  lines: [
    { sku: "WIDGET", price: 19.99, quantity: 2 },
    { sku: "GADGET", price: 29.99, quantity: 1 },
  ],
});
if (placeResult.ok) {
  console.log(
    `order ${placeResult.value.id} placed, total: ${formatMoney(placeResult.value.total)}`,
  );
} else {
  console.log(`rejected: ${placeResult.error}`);
}

// Nothing was mutated: the local draft is still the empty draft it was.
console.log(`original draft untouched: ${draft.kind}, ${draft.lines.length} lines`);

// The invariant in action: a placed order refuses to grow, and says so with an Err value.
const stored = store.load("order-1");
if (stored === undefined) throw new Error("order-1 should be in the store");
const lateResult = bind(createOrderLine("LATE-ITEM", money(5), 1), (line) => addLine(stored, line));
if (!lateResult.ok) console.log(`rejected: ${lateResult.error}`);

// A smart constructor refuses an invalid line, also as a value.
const brokenLine = createOrderLine("BROKEN", money(1), 0);
if (!brokenLine.ok) console.log(`rejected: ${brokenLine.error}`);
