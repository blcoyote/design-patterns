// One kind of fact per event. A real system would use one type per event; a
// single shape keeps this example short.
interface OrderEvent {
  type: "OrderPlaced" | "OrderCancelled";
  orderId: string;
  customerId: string;
  total: number;
}

interface LoggedEvent {
  position: number;
  event: OrderEvent;
}

// [eventLog]
// The source of truth: an append-only log. Positions are counters, so they are
// stable and ordered.
class EventLog {
  private entries: LoggedEvent[] = [];

  // [logAppend]
  append(event: OrderEvent): number {
    const position = this.entries.length + 1;
    this.entries.push({ position, event });
    console.log(`log: #${position} ${event.type} ${event.orderId}`);
    return position;
  }
  // [/logAppend]

  // [logRead]
  // filter() returns a new array, so callers iterate a snapshot.
  readAfter(position: number): LoggedEvent[] {
    return this.entries.filter((entry) => entry.position > position);
  }
  // [/logRead]
}
// [/eventLog]

// [readModel]
interface CustomerRow {
  orders: number;
  spent: number;
}

// A disposable read model shaped for one question: how much has each customer
// ordered? It can be deleted and rebuilt from the log at any time.
class CustomerSummaryView {
  private rows = new Map<string, CustomerRow>();
  // The position of the last event applied. It is stored with the data it
  // describes (a real store updates both in one transaction).
  checkpoint = 0;

  // [viewApply]
  apply({ position, event }: LoggedEvent): void {
    // A position at or below the checkpoint was already applied, so a
    // redelivered event changes nothing.
    if (position <= this.checkpoint) {
      console.log(`view: #${position} already applied, ignored`);
      return;
    }
    const row = this.rows.get(event.customerId) ?? { orders: 0, spent: 0 };
    const sign = event.type === "OrderPlaced" ? 1 : -1;
    this.rows.set(event.customerId, {
      orders: row.orders + sign,
      spent: row.spent + sign * event.total,
    });
    this.checkpoint = position;
  }
  // [/viewApply]

  // [viewGet]
  get(customerId: string): CustomerRow | undefined {
    return this.rows.get(customerId);
  }
  // [/viewGet]

  // [viewReset]
  reset(): void {
    this.rows.clear();
    this.checkpoint = 0;
  }
  // [/viewReset]
}
// [/readModel]

// [projector]
// The only writer of the read model. It never decides anything: it replays what
// the log says happened.
class Projector {
  constructor(
    private log: EventLog,
    private view: CustomerSummaryView,
  ) {}

  // [catchUp]
  // Pull everything after the view's own checkpoint and apply it in order.
  // A real projector runs this on a schedule or when it is notified.
  catchUp(): void {
    const pending = this.log.readAfter(this.view.checkpoint);
    for (const logged of pending) this.view.apply(logged);
    console.log(
      `projector: applied ${pending.length} event(s) (checkpoint ${this.view.checkpoint})`,
    );
  }
  // [/catchUp]

  // [rebuild]
  // Throw the read model away and replay the whole log into it.
  rebuild(): void {
    this.view.reset();
    console.log("projector: view reset");
    this.catchUp();
  }
  // [/rebuild]
}
// [/projector]

// [client]
const log = new EventLog();
const view = new CustomerSummaryView();
const projector = new Projector(log, view);

function show(customerId: string): void {
  const row = view.get(customerId);
  console.log(
    row ? `${customerId}: orders=${row.orders} spent=${row.spent}` : `${customerId}: no row yet`,
  );
}

log.append({ type: "OrderPlaced", orderId: "o1", customerId: "ada", total: 40 });
// log: #1 OrderPlaced o1
log.append({ type: "OrderPlaced", orderId: "o2", customerId: "grace", total: 25 });
// log: #2 OrderPlaced o2
log.append({ type: "OrderPlaced", orderId: "o3", customerId: "ada", total: 35 });
// log: #3 OrderPlaced o3
show("ada"); // the read model has not caught up yet
// ada: no row yet

projector.catchUp();
// projector: applied 3 event(s) (checkpoint 3)
show("ada");
// ada: orders=2 spent=75
show("grace");
// grace: orders=1 spent=25

log.append({ type: "OrderCancelled", orderId: "o1", customerId: "ada", total: 40 });
// log: #4 OrderCancelled o1
projector.catchUp();
// projector: applied 1 event(s) (checkpoint 4)
show("ada");
// ada: orders=1 spent=35

view.apply(log.readAfter(3)[0]); // the same event delivered a second time
// view: #4 already applied, ignored

projector.rebuild();
// projector: view reset
// projector: applied 4 event(s) (checkpoint 4)
show("ada");
// ada: orders=1 spent=35
show("grace");
// grace: orders=1 spent=25
// [/client]
