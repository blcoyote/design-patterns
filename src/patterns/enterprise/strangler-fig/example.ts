// [http]
/** What either system answers: a status code and a body. */
interface Reply {
  status: number;
  body: string;
}

/** What the facade hands back: the reply plus which system produced it. */
interface Routed {
  status: number;
  body: string;
  servedBy: "legacy" | "modern";
}

/** "/products" -> ("products", ""), "/orders/42" -> ("orders", "42"). */
function parsePath(path: string): { feature: string; id: string } {
  const parts = path.split("/"); // "/orders/42" -> ["", "orders", "42"]
  return { feature: parts[1] ?? "", id: parts[2] ?? "" };
}
// [/http]

// [legacy]
interface OrderRecord {
  id: string;
  items: number;
}

// The old code being strangled. It is never edited during the migration.
class LegacyMonolith {
  calls = 0;
  private readonly products = ["p-1", "p-2", "p-3"];
  private readonly orders: OrderRecord[] = [{ id: "42", items: 2 }];

  handle(path: string): Reply {
    this.calls++;
    const { feature, id } = parsePath(path);
    const order = this.orders.find((o) => o.id === id);
    switch (feature) {
      case "products":
        return { status: 200, body: `${this.products.length} products` };
      case "orders":
        return order
          ? { status: 200, body: `order ${order.id}, ${order.items} items` }
          : { status: 404, body: `order ${id} not found` };
      case "invoices":
        return order
          ? { status: 200, body: `invoice for order ${order.id}: ${order.items} lines` }
          : { status: 404, body: `order ${id} not found` };
      default:
        throw new Error(`legacy has no feature "${feature}"`); // programmer bug, never exercised
    }
  }

  /** A copy of the order list, which the migration reads. */
  ordersSnapshot(): OrderRecord[] {
    return this.orders.map((o) => ({ ...o }));
  }
}
// [/legacy]

// [modern]
class ModernService {
  calls = 0;
  // The modern catalog was built with its own copy of the products before this example starts.
  private readonly products = ["p-1", "p-2", "p-3"];
  private readonly orders: OrderRecord[] = []; // empty until the migration imports orders

  importOrder(record: OrderRecord): void {
    this.orders.push({ ...record });
  }

  handle(path: string): Reply {
    this.calls++;
    const { feature, id } = parsePath(path);
    const order = this.orders.find((o) => o.id === id);
    switch (feature) {
      case "products":
        return { status: 200, body: `${this.products.length} products` };
      case "orders":
        return order
          ? { status: 200, body: `order ${order.id}, ${order.items} items` }
          : { status: 404, body: `order ${id} not found` }; // a wrong answer, not a crash
      case "invoices":
        return order
          ? { status: 200, body: `invoice for order ${order.id}: ${order.items} lines` }
          : { status: 404, body: `order ${id} not found` };
      default:
        throw new Error(`modern has no feature "${feature}"`); // programmer bug, never exercised
    }
  }
}
// [/modern]

// [migration]
// Moving the data is usually the hard part (dual writes, change data capture, sync jobs).
// One explicit copy stands in for all of that here.
function copyOrders(legacy: LegacyMonolith, modern: ModernService): number {
  const records = legacy.ordersSnapshot();
  for (const record of records) {
    modern.importOrder(record);
  }
  console.log(`[migration] orders copied to the modern store: ${records.length}`);
  return records.length;
}
// [/migration]

// [facade]
type Target = "legacy" | "modern";

const FEATURES = ["products", "orders", "invoices"];

// Real facades are reverse proxies, API gateways or load-balancer rules, sometimes with
// feature flags or a percentage of traffic. Here the facade is an in-process object, and a
// feature moves all at once by an explicit call.
class StranglerFacade {
  retired = false;
  private readonly routes = new Map<string, Target>(FEATURES.map((f) => [f, "legacy"]));

  constructor(
    private readonly legacy: LegacyMonolith,
    private readonly modern: ModernService,
  ) {}

  handle(path: string): Routed {
    const { feature } = parsePath(path);
    const target = this.routes.get(feature);
    if (target === undefined) {
      throw new Error(`facade has no route for "${feature}"`); // programmer bug, never exercised
    }
    const reply = target === "legacy" ? this.legacy.handle(path) : this.modern.handle(path);
    return { status: reply.status, body: reply.body, servedBy: target };
  }

  migrate(feature: string): void {
    this.routes.set(feature, "modern");
    console.log(`[facade] ${feature} -> modern`);
  }

  // Rollback only works here because nothing is written in this scenario, so the legacy side
  // still has current data. In a real system, writes made through the modern side must flow
  // back to the legacy side, or a rollback loses them.
  rollback(feature: string): void {
    this.routes.set(feature, "legacy");
    console.log(`[facade] ${feature} -> legacy (rollback)`);
  }

  /** The legacy system can go only when no feature is routed to it. */
  retireLegacy(): boolean {
    const stillLegacy = FEATURES.filter((f) => this.routes.get(f) === "legacy");
    if (stillLegacy.length > 0) {
      console.log(`[facade] cannot retire legacy: ${stillLegacy.join(", ")} still routed to it`);
      return false;
    }
    this.retired = true;
    console.log("[facade] legacy retired");
    return true;
  }
}
// [/facade]

// [usage]
// Usage
const legacy = new LegacyMonolith();
const modern = new ModernService();
const facade = new StranglerFacade(legacy, modern);

function send(facade: StranglerFacade, path: string): void {
  const r = facade.handle(path);
  console.log(`GET ${path} -> ${r.status} from ${r.servedBy}: ${r.body}`);
}

send(facade, "/products"); // 200 from legacy: 3 products
send(facade, "/orders/42"); // 200 from legacy: order 42, 2 items

facade.migrate("products");
send(facade, "/products"); // 200 from modern: 3 products

facade.migrate("orders"); // too early: the modern store has no orders yet
send(facade, "/orders/42"); // 404 from modern: order 42 not found
facade.rollback("orders");
send(facade, "/orders/42"); // 200 from legacy again

copyOrders(legacy, modern); // 1 order copied
facade.migrate("orders");
send(facade, "/orders/42"); // 200 from modern: order 42, 2 items

facade.retireLegacy(); // refused: invoices still routed to legacy
facade.migrate("invoices");
send(facade, "/invoices/42"); // 200 from modern: invoice for order 42: 2 lines
facade.retireLegacy(); // succeeds: nothing routes to legacy any more

console.log(`calls: legacy ${legacy.calls}, modern ${modern.calls}`); // legacy 3, modern 4
// [/usage]
