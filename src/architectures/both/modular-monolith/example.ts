// [contracts]
/**
 * The public contracts the modules share (a "published language"). Nothing internal lives
 * here: no module's records, stores or implementation classes, only what crosses a boundary.
 */

/** What Catalog's API returns. Deliberately NOT Catalog's internal record. */
interface ProductInfo {
  sku: string;
  name: string;
  priceCents: number;
}

interface CatalogApi {
  getProduct(sku: string): ProductInfo | undefined;
  setPrice(sku: string, priceCents: number): void;
}

interface OrderLineRequest {
  sku: string;
  quantity: number;
}

/** A rejection is a normal result, not an exception: orderId is "" and reason is set. */
interface PlaceOrderResult {
  accepted: boolean;
  /** Empty string when the order was rejected. */
  orderId: string;
  totalCents: number;
  /** Empty string when the order was accepted. */
  reason: string;
}

interface OrderingApi {
  placeOrder(customerId: string, lines: OrderLineRequest[]): PlaceOrderResult;
  orderTotal(orderId: string): number | undefined;
}

/** The integration event Ordering publishes. Shipping depends on this shape, not on Ordering. */
interface OrderPlaced {
  orderId: string;
  customerId: string;
  totalCents: number;
}

interface ShippingApi {
  /** "ready to ship" or "unknown". */
  statusFor(orderId: string): string;
}

/** Every module's public API, by module name. ModuleName is the set of its keys. */
interface ModuleApis {
  catalog: CatalogApi;
  ordering: OrderingApi;
  shipping: ShippingApi;
}
type ModuleName = keyof ModuleApis;

/** Money is integer cents everywhere. Formats 6997 as "69.97" with integer arithmetic only (no floats). */
function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}
// [/contracts]

// [eventBus]
type OrderPlacedHandler = (event: OrderPlaced) => void;

/**
 * An in-process event bus for OrderPlaced. Publish calls every handler synchronously, in
 * subscription order, on the caller's own call stack: same process, so no network. A real
 * modular monolith often pairs this with an outbox, so the event commits together with the
 * publishing module's own data. This bus has no outbox and does not persist anything.
 */
class InProcessEventBus {
  private readonly handlers: OrderPlacedHandler[] = [];

  subscribe(handler: OrderPlacedHandler): void {
    this.handlers.push(handler);
  }

  publish(event: OrderPlaced): void {
    for (const handler of this.handlers) handler(event);
  }
}
// [/eventBus]

// [host]
/** What a module's factory receives: the shared bus and a way to reach the modules it declared. */
interface ModuleContext {
  readonly bus: InProcessEventBus;
  use<K extends ModuleName>(target: K): ModuleApis[K];
}

/**
 * The composition root of the single deployable. It starts each module, hands it a
 * ModuleContext, and refuses any lookup of a module the requester did not declare.
 */
class ModuleHost {
  /** Names of the started modules, in registration order. */
  readonly started: ModuleName[] = [];
  private readonly apis: Partial<ModuleApis> = {};
  private readonly dependencies = new Map<ModuleName, ModuleName[]>();

  constructor(private readonly bus: InProcessEventBus) {}

  /** Registering is starting: the factory runs immediately and only its returned API is kept. */
  register<K extends ModuleName>(
    name: K,
    dependsOn: ModuleName[],
    factory: (ctx: ModuleContext) => ModuleApis[K],
  ): ModuleApis[K] {
    this.dependencies.set(name, dependsOn);
    const ctx: ModuleContext = {
      bus: this.bus,
      use: (target) => this.use(name, target),
    };
    const api = factory(ctx);
    this.apis[name] = api;
    this.started.push(name);
    return api;
  }

  /**
   * The boundary check: a module may only reach modules it declared. In a real codebase an
   * architecture test enforces the same rule (ArchUnit/NetArchTest, import-linter, Go's internal/ packages).
   */
  use<K extends ModuleName>(requester: ModuleName, target: K): ModuleApis[K] {
    if (!this.dependencies.get(requester)?.includes(target)) {
      throw new Error(`${requester} does not declare a dependency on ${target}`);
    }
    const api = this.apis[target];
    if (api === undefined) throw new Error(`${target} is not started`);
    return api;
  }
}
// [/host]

// [catalog]
/** Catalog's internal record. It never leaves the module: supplierCode is internal only. */
interface CatalogRecord {
  sku: string;
  name: string;
  priceCents: number;
  supplierCode: string;
}

/**
 * The Catalog module. In TypeScript the hiding mechanism is a closure: the factory returns
 * only the CatalogApi object, and the store lives in the closure where no other module can
 * reach it. Other languages hide it differently (private classes, naming convention, unexported types).
 */
function createCatalogModule(_ctx: ModuleContext): CatalogApi {
  const records = new Map<string, CatalogRecord>([
    ["sku-1", { sku: "sku-1", name: "Widget", priceCents: 1999, supplierCode: "SUP-W" }],
    ["sku-2", { sku: "sku-2", name: "Gadget", priceCents: 2999, supplierCode: "SUP-G" }],
  ]);

  return {
    getProduct(sku) {
      const record = records.get(sku);
      if (!record) return undefined;
      // Map the internal record to the public ProductInfo; supplierCode stays inside.
      return { sku: record.sku, name: record.name, priceCents: record.priceCents };
    },
    setPrice(sku, priceCents) {
      const record = records.get(sku);
      if (!record) return;
      record.priceCents = priceCents;
      console.log(`[catalog] ${sku} repriced to ${formatCents(priceCents)}`);
    },
  };
}
// [/catalog]

// [ordering]
/** One stored order line. unitPriceCents is Ordering's own copy, taken at placement time. */
interface StoredOrderLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

interface StoredOrder {
  orderId: string;
  customerId: string;
  lines: StoredOrderLine[];
}

/**
 * The Ordering module. It asks the host for Catalog once, at creation: that call succeeds
 * only because "catalog" is in Ordering's declared dependencies. Its orders live in the
 * closure, so other modules reach them only through OrderingApi.
 */
function createOrderingModule(ctx: ModuleContext): OrderingApi {
  const catalog = ctx.use("catalog");
  const orders = new Map<string, StoredOrder>();
  let nextOrderNumber = 1; // counter-based ids, never timestamps

  return {
    placeOrder(customerId, lines) {
      const storedLines: StoredOrderLine[] = [];
      for (const line of lines) {
        const product = catalog.getProduct(line.sku);
        if (!product) {
          // Reject before assigning an id: nothing is stored and nothing is published.
          return {
            accepted: false,
            orderId: "",
            totalCents: 0,
            reason: `unknown product ${line.sku}`,
          };
        }
        storedLines.push({
          sku: line.sku,
          quantity: line.quantity,
          unitPriceCents: product.priceCents,
        });
      }

      let totalCents = 0;
      for (const line of storedLines) totalCents += line.unitPriceCents * line.quantity;

      const orderId = `order-${nextOrderNumber++}`;
      orders.set(orderId, { orderId, customerId, lines: storedLines }); // save the copied prices
      ctx.bus.publish({ orderId, customerId, totalCents });
      return { accepted: true, orderId, totalCents, reason: "" };
    },

    orderTotal(orderId) {
      const order = orders.get(orderId);
      if (!order) return undefined;
      // Computed from Ordering's own stored copy: Catalog is never called here.
      let totalCents = 0;
      for (const line of order.lines) totalCents += line.unitPriceCents * line.quantity;
      return totalCents;
    },
  };
}
// [/ordering]

// [shipping]
interface Shipment {
  shipmentId: string;
  status: string;
}

/**
 * The Shipping module. It declares no module dependencies: it knows only the OrderPlaced
 * contract and learns about orders by subscribing to the bus.
 */
function createShippingModule(ctx: ModuleContext): ShippingApi {
  const shipments = new Map<string, Shipment>(); // keyed by orderId
  let nextShipmentNumber = 1; // its own counter, independent of Ordering's

  ctx.bus.subscribe((event) => {
    const shipmentId = `ship-${nextShipmentNumber++}`;
    shipments.set(event.orderId, { shipmentId, status: "ready to ship" });
    console.log(`[shipping] shipment ${shipmentId} created for ${event.orderId}`);
  });

  return {
    statusFor(orderId) {
      return shipments.get(orderId)?.status ?? "unknown";
    },
  };
}
// [/shipping]

// [usage]
const bus = new InProcessEventBus();
const host = new ModuleHost(bus);
// Registration order is start order; ordering needs catalog, so catalog is registered first.
const catalog = host.register("catalog", [], createCatalogModule);
const ordering = host.register("ordering", ["catalog"], createOrderingModule);
const shipping = host.register("shipping", [], createShippingModule);
console.log(`modules started: ${host.started.join(", ")}`);

// A client outside the monolith talks to the public APIs only.
const placed = ordering.placeOrder("cust-42", [
  { sku: "sku-1", quantity: 2 },
  { sku: "sku-2", quantity: 1 },
]);
console.log(`${placed.orderId} placed for cust-42, total ${formatCents(placed.totalCents)}`);

// Unknown product: a rejected result, not an exception. No id is assigned.
const rejected = ordering.placeOrder("cust-42", [{ sku: "sku-9", quantity: 1 }]);
console.log(`rejected: ${rejected.reason}`);

// Catalog changes its own price; Ordering kept its own copy of the old one.
catalog.setPrice("sku-1", 2499);
const total = ordering.orderTotal("order-1");
console.log(
  total === undefined ? "order-1 total unknown" : `order-1 total still ${formatCents(total)}`,
);

console.log(`shipping status for order-1: ${shipping.statusFor("order-1")}`);

// Shipping never declared catalog, so the host refuses the lookup.
try {
  host.use("shipping", "catalog");
} catch (err) {
  if (err instanceof Error) console.log(`rejected: ${err.message}`);
}
// [/usage]
