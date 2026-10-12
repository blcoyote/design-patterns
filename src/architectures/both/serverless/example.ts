// [events]
/**
 * What a function is given and what it may return. A function never sees the platform: it
 * receives one trigger event plus the managed services, and that is all. The events form a
 * union discriminated by kind, one member per way a function can be triggered.
 */

/** A request from outside. Money is integer cents everywhere. */
interface HttpEvent {
  kind: "http";
  method: string;
  path: string;
  body: { customerId: string; totalCents: number };
}

/** A message the platform took from a queue and hands to the function subscribed to it. */
interface QueueEvent {
  kind: "queue";
  queue: string;
  message: { orderId: string };
}

/** A schedule firing. It carries no data: the function reads whatever it needs from the services. */
interface ScheduleEvent {
  kind: "schedule";
  schedule: string;
}

type TriggerEvent = HttpEvent | QueueEvent | ScheduleEvent;

interface HttpResponse {
  status: number;
  body: string;
}

/**
 * The function contract. Only an http function has a caller waiting for an answer, so the
 * others return undefined. One instance is created per cold start and handles invocations
 * one after another.
 */
interface FunctionInstance {
  handle(event: TriggerEvent, services: Services): HttpResponse | undefined;
}

/** What makes the platform run a function. */
type Trigger =
  | { kind: "http"; route: string }
  | { kind: "queue"; queue: string }
  | { kind: "schedule"; schedule: string };

/** A deployed function: its name, what triggers it, and how to build a fresh instance of it. */
interface FunctionDefinition {
  readonly name: string;
  readonly trigger: Trigger;
  readonly create: () => FunctionInstance;
}

/** Formats 6997 as "69.97" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator). */
function formatCents(cents: number): string {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  return `${cents < 0 ? "-" : ""}${whole}.${String(fraction).padStart(2, "0")}`;
}
// [/events]

// [services]
/** One row in the orders table. */
interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly status: "received" | "receipted";
}

/**
 * A managed table that outlives every function instance. Real systems use a hosted database
 * (DynamoDB, Cosmos DB, Firestore); here it is a Map in memory. The id counter lives in the
 * store too, so ids stay unique no matter how many instances come and go.
 */
class OrderStore {
  // A Map iterates in insertion order, and saving an existing id keeps its place.
  private readonly rows = new Map<string, Order>();
  private lastId = 0;

  nextOrderId(): string {
    this.lastId++;
    return `order-${this.lastId}`;
  }

  /** Inserts the order, or replaces the row with the same id. */
  save(order: Order): void {
    this.rows.set(order.id, order);
  }

  get(id: string): Order | undefined {
    return this.rows.get(id);
  }

  /** Every order, oldest first. */
  all(): Order[] {
    return [...this.rows.values()];
  }
}

/**
 * Managed named queues, first in first out (like SQS, Service Bus or Pub/Sub). A message
 * waits here until the platform takes it and hands it to the subscribed function.
 */
class MessageQueues {
  private readonly queues = new Map<string, { orderId: string }[]>();

  enqueue(queue: string, message: { orderId: string }): void {
    const waiting = this.queues.get(queue);
    if (waiting === undefined) this.queues.set(queue, [message]);
    else waiting.push(message);
  }

  /** Removes and returns the oldest message, or undefined when the queue is empty. */
  take(queue: string): { orderId: string } | undefined {
    return this.queues.get(queue)?.shift();
  }
}

/** Handed to every invocation. Functions keep nothing that must last anywhere else. */
interface Services {
  readonly orders: OrderStore;
  readonly queues: MessageQueues;
}
// [/services]

// [platform]
interface DeployedFunction {
  readonly def: FunctionDefinition;
  /** At most one warm instance per function. */
  warm: FunctionInstance | undefined;
  coldStarts: number;
}

/**
 * The managed runtime. It decides when functions are created, reused, triggered and
 * discarded. AWS Lambda, Azure Functions and Google Cloud Functions make all of these
 * decisions themselves and run many instances of one function side by side; this class only
 * makes it visible. It keeps at most one warm instance per function because the invocations
 * here run one after another, and there are no timers or clock: reclaimIdle stands for idle
 * time passing and tick stands for a schedule firing.
 */
class Platform {
  /** Functions in registration order: that order is the order queues are drained in. */
  private readonly functions: DeployedFunction[] = [];

  constructor(private readonly services: Services) {}

  register(def: FunctionDefinition): void {
    this.functions.push({ def, warm: undefined, coldStarts: 0 });
  }

  /** Routes a request to the function whose http trigger has the route "<method> <path>". */
  http(
    method: string,
    path: string,
    body: { customerId: string; totalCents: number },
  ): HttpResponse {
    const route = `${method} ${path}`;
    const target = this.functions.find(
      (candidate) => candidate.def.trigger.kind === "http" && candidate.def.trigger.route === route,
    );
    // A request nobody listens for is a programmer bug, not something to answer with a 404.
    if (target === undefined) throw new Error(`no function for ${route}`);
    const response = this.invoke(target.def, { kind: "http", method, path, body });
    if (response === undefined) throw new Error(`${target.def.name} returned no response`);
    return response;
  }

  /**
   * For each queue-triggered function in registration order, keeps taking the next message
   * from its queue and invoking the function until that queue is empty.
   */
  drainQueues(): void {
    for (const deployed of this.functions) {
      const trigger = deployed.def.trigger;
      if (trigger.kind !== "queue") continue;
      for (
        let message = this.services.queues.take(trigger.queue);
        message !== undefined;
        message = this.services.queues.take(trigger.queue)
      ) {
        this.invoke(deployed.def, { kind: "queue", queue: trigger.queue, message });
      }
    }
  }

  /** A schedule fires: invokes the function subscribed to it. */
  tick(schedule: string): void {
    const target = this.functions.find(
      (candidate) =>
        candidate.def.trigger.kind === "schedule" && candidate.def.trigger.schedule === schedule,
    );
    if (target === undefined) throw new Error(`no function for schedule ${schedule}`);
    this.invoke(target.def, { kind: "schedule", schedule });
  }

  /** Scale to zero: drops every warm instance, and with it everything that was only in memory. */
  reclaimIdle(): void {
    let reclaimed = 0;
    for (const deployed of this.functions) {
      if (deployed.warm !== undefined) reclaimed++;
      deployed.warm = undefined;
    }
    console.log(`[platform] idle instances reclaimed: ${reclaimed}`);
  }

  coldStarts(name: string): number {
    return this.deployedOf(name).coldStarts;
  }

  private invoke(def: FunctionDefinition, event: TriggerEvent): HttpResponse | undefined {
    const deployed = this.deployedOf(def.name);
    let instance = deployed.warm;
    if (instance === undefined) {
      console.log(`[platform] ${def.name}: cold start`);
      instance = def.create();
      deployed.coldStarts++;
      deployed.warm = instance; // stays warm after this invocation, until reclaimIdle
    } else {
      console.log(`[platform] ${def.name}: warm`);
    }
    return instance.handle(event, this.services);
  }

  private deployedOf(name: string): DeployedFunction {
    const deployed = this.functions.find((candidate) => candidate.def.name === name);
    if (deployed === undefined) throw new Error(`unknown function ${name}`);
    return deployed;
  }
}
// [/platform]

// [createOrder]
class CreateOrderInstance implements FunctionInstance {
  // Instance memory: it survives from one invocation to the next only while the platform
  // keeps this instance warm, and starts at zero again after every cold start. This is
  // exactly the kind of state you must not rely on. The order ids come from the store.
  private calls = 0;

  handle(event: TriggerEvent, services: Services): HttpResponse {
    if (event.kind !== "http")
      throw new Error(`createOrder expects an http event, got ${event.kind}`);
    this.calls++;

    const { customerId, totalCents } = event.body;
    if (totalCents <= 0) {
      return { status: 400, body: `total must be positive (instance call ${this.calls})` };
    }

    // Two separate writes: save the order, then enqueue the message. If this instance dies
    // between them, the order exists and nobody is ever told. A real system would close that
    // gap with an outbox or the platform's transactional outputs; this example has neither.
    const id = services.orders.nextOrderId();
    services.orders.save({ id, customerId, totalCents, status: "received" });
    services.queues.enqueue("order-placed", { orderId: id });
    return { status: 201, body: `${id} received (instance call ${this.calls})` };
  }
}

const createOrder: FunctionDefinition = {
  name: "createOrder",
  trigger: { kind: "http", route: "POST /orders" },
  create: () => new CreateOrderInstance(),
};
// [/createOrder]

// [sendReceipt]
/** Runs once per order-placed message: reads the order from the store and marks it receipted. */
class SendReceiptInstance implements FunctionInstance {
  handle(event: TriggerEvent, services: Services): undefined {
    if (event.kind !== "queue")
      throw new Error(`sendReceipt expects a queue event, got ${event.kind}`);

    const order = services.orders.get(event.message.orderId);
    if (order === undefined) throw new Error(`unknown order ${event.message.orderId}`);
    console.log(
      `[email] receipt for ${order.id} to ${order.customerId}: ${formatCents(order.totalCents)}`,
    );
    services.orders.save({ ...order, status: "receipted" });
    return undefined;
  }
}

const sendReceipt: FunctionDefinition = {
  name: "sendReceipt",
  trigger: { kind: "queue", queue: "order-placed" },
  create: () => new SendReceiptInstance(),
};
// [/sendReceipt]

// [dailyReport]
/** Runs when the schedule fires. It only reads: whatever it reports comes from the store. */
class DailyReportInstance implements FunctionInstance {
  handle(event: TriggerEvent, services: Services): undefined {
    if (event.kind !== "schedule")
      throw new Error(`dailyReport expects a schedule event, got ${event.kind}`);

    const orders = services.orders.all();
    const totalCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
    const receipted = orders.filter((order) => order.status === "receipted").length;
    console.log(
      `[report] ${orders.length} orders, total ${formatCents(totalCents)}, ${receipted} receipted`,
    );
    return undefined;
  }
}

const dailyReport: FunctionDefinition = {
  name: "dailyReport",
  trigger: { kind: "schedule", schedule: "daily-report" },
  create: () => new DailyReportInstance(),
};
// [/dailyReport]

// [usage]
const services: Services = { orders: new OrderStore(), queues: new MessageQueues() };
const platform = new Platform(services);
platform.register(createOrder);
platform.register(sendReceipt);
platform.register(dailyReport);

function post(customerId: string, totalCents: number): void {
  const response = platform.http("POST", "/orders", { customerId, totalCents });
  console.log(`POST /orders -> ${response.status} ${response.body}`);
}

// The first request cold-starts createOrder, the next two reuse its warm instance.
post("cust-42", 6997);
post("cust-7", 2999);
post("cust-9", 0);

// Nothing has run sendReceipt yet: the platform does that when it drains the queue.
platform.drainQueues();

// Idle time passes: every instance is dropped, and the call counter with it.
platform.reclaimIdle();
post("cust-42", 1500);

// order-3 is still queued, so the report counts it but sees only two receipted orders.
platform.tick("daily-report");
console.log(
  `cold starts: createOrder ${platform.coldStarts("createOrder")}, sendReceipt ${platform.coldStarts("sendReceipt")}, dailyReport ${platform.coldStarts("dailyReport")}`,
);
// [/usage]
