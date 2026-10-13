// [bulkhead]
/** A fixed number of concurrent-call slots, used by one dependency or shared by several. */
class Bulkhead {
  inFlight = 0;
  rejected = 0;

  constructor(
    readonly name: string,
    readonly maxConcurrent: number,
  ) {}

  // There is no waiting queue: a full bulkhead rejects at once. Real ones often
  // allow a short wait or a bounded queue before rejecting.
  tryAcquire(): boolean {
    if (this.inFlight >= this.maxConcurrent) {
      this.rejected++; // a rejected call never takes a slot
      return false;
    }
    this.inFlight++;
    return true;
  }

  release(): void {
    if (this.inFlight === 0) {
      throw new Error(`${this.name}: release without a matching acquire`);
    }
    this.inFlight--;
  }
}
// [/bulkhead]

// [dependency]
// Concurrency is simulated: a started call stays in flight until the calling code
// finishes it, which stands in for a slow response. There are no threads, timers or
// awaits. Real calls finish on their own on many threads, so a real limiter must be
// thread-safe (atomic counters or a semaphore).
class Dependency {
  private readonly inFlightIds: string[] = [];

  constructor(
    readonly name: string,
    private readonly bulkhead: Bulkhead,
  ) {}

  start(callId: string): boolean {
    if (!this.bulkhead.tryAcquire()) {
      console.log(
        `[${this.name}] ${callId} rejected: ${this.bulkhead.name} is full (${this.bulkhead.inFlight}/${this.bulkhead.maxConcurrent})`,
      );
      return false;
    }
    this.inFlightIds.push(callId);
    console.log(
      `[${this.name}] ${callId} started (${this.bulkhead.name} ${this.bulkhead.inFlight}/${this.bulkhead.maxConcurrent})`,
    );
    return true;
  }

  finish(callId: string): void {
    const index = this.inFlightIds.indexOf(callId);
    if (index === -1) {
      throw new Error(`${this.name}: ${callId} is not in flight`);
    }
    this.inFlightIds.splice(index, 1); // removes the first match only
    this.bulkhead.release();
    console.log(
      `[${this.name}] ${callId} finished (${this.bulkhead.name} ${this.bulkhead.inFlight}/${this.bulkhead.maxConcurrent})`,
    );
  }
}
// [/dependency]

// [shared]
function runShared(): Bulkhead {
  console.log("--- shared pool (no bulkhead), limit 4 ---");
  const shared = new Bulkhead("shared", 4);
  const payments = new Dependency("payments", shared);
  const recommendations = new Dependency("recommendations", shared);

  // Recommendations is slow: its calls stay in flight.
  recommendations.start("r1");
  recommendations.start("r2");
  recommendations.start("r3");
  recommendations.start("r4");

  // One slow dependency used up the slots that payments needed.
  payments.start("p1"); // rejected
  return shared;
}
// [/shared]

// [isolated]
function runIsolated(): [Bulkhead, Bulkhead] {
  console.log("--- one bulkhead per dependency, 2 slots each ---");
  const paymentsBulkhead = new Bulkhead("payments", 2);
  const recsBulkhead = new Bulkhead("recommendations", 2);
  const payments = new Dependency("payments", paymentsBulkhead);
  const recommendations = new Dependency("recommendations", recsBulkhead);

  recommendations.start("r1");
  recommendations.start("r2");
  recommendations.start("r3"); // rejected: only recommendations is full

  payments.start("p1"); // unaffected by the slow dependency
  payments.finish("p1");

  recommendations.finish("r1"); // frees a slot...
  recommendations.start("r4"); // ...which the next call reuses
  return [paymentsBulkhead, recsBulkhead];
}
// [/isolated]

// [usage]
// Usage
const shared = runShared();
const [paymentsBulkhead, recsBulkhead] = runIsolated();
console.log(
  `rejected: shared ${shared.rejected}, payments ${paymentsBulkhead.rejected}, recommendations ${recsBulkhead.rejected}`,
);
// [/usage]
