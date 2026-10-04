// [clock]
/** A fake clock: time only moves when the usage code calls advance(). No real time anywhere. */
class Clock {
  nowMs = 0;

  advance(ms: number): void {
    this.nowMs += ms;
  }
}
// [/clock]

// [service]
/** A downstream dependency that can start failing under load. */
class RemoteService {
  healthy = true; // flipped by the usage code to simulate an outage and a recovery
  calls = 0;

  async request(): Promise<string> {
    this.calls++;
    if (!this.healthy) {
      throw new Error("service unavailable");
    }
    return "ok";
  }
}
// [/service]

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

// [breaker]
class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private failureCount = 0;
  private nextAttempt = 0;
  private trialInFlight = false;
  // Bumped whenever the breaker opens or enters Half-Open, so a slow call that
  // started in an earlier state can't drive a transition it never observed.
  private generation = 0;

  constructor(
    private readonly clock: Clock,
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
  ) {}

  /** Read-only views for the usage printout. */
  get currentState(): BreakerState {
    return this.state;
  }

  get status(): string {
    return `${this.state}, failures: ${this.failureCount}/${this.failureThreshold}`;
  }

  // [call]
  async call<T>(fn: () => Promise<T>): Promise<T> {
    // [openCheck]
    if (this.state === "OPEN") {
      if (this.clock.nowMs < this.nextAttempt) {
        throw new Error("circuit open, failing fast"); // fn() never runs
      }
      // [halfOpenCheck]
      this.state = "HALF_OPEN"; // cooldown elapsed: let exactly one trial through
      this.generation++;
      // [/halfOpenCheck]
    }
    // Only one probe at a time: while it is in flight, everyone else keeps failing fast.
    if (this.state === "HALF_OPEN" && this.trialInFlight) {
      throw new Error("circuit half-open, trial in progress");
    }
    // [/openCheck]

    const isTrial = this.state === "HALF_OPEN";
    const callGeneration = this.generation; // only *this* call's own outcome may move that generation on
    if (isTrial) this.trialInFlight = true;
    try {
      // [invoke]
      const result = await fn();
      // [/invoke]
      // [onSuccess]
      if (callGeneration === this.generation) {
        this.failureCount = 0;
        this.state = "CLOSED";
      }
      // [/onSuccess]
      return result;
    } catch (err) {
      // [onFailure]
      if (callGeneration === this.generation) {
        if (this.state === "HALF_OPEN") {
          this.trip(); // the trial failed: straight back to Open
        } else if (++this.failureCount >= this.failureThreshold) {
          this.trip();
        }
      }
      // [/onFailure]
      throw err;
    } finally {
      if (isTrial) this.trialInFlight = false;
    }
  }
  // [/call]

  private trip(): void {
    this.state = "OPEN";
    this.nextAttempt = this.clock.nowMs + this.cooldownMs;
    this.generation++;
  }
}
// [/breaker]

// [client]
// Usage
const COOLDOWN_MS = 4000;
const clock = new Clock();
const service = new RemoteService();
const breaker = new CircuitBreaker(clock, /* failureThreshold */ 3, COOLDOWN_MS);

async function attempt(label: string): Promise<void> {
  let ranWhile: BreakerState | undefined;
  let outcome: string;
  try {
    outcome = await breaker.call(() => {
      ranWhile = breaker.currentState; // only set if the breaker actually lets fn() run
      return service.request();
    });
  } catch (err) {
    outcome = err instanceof Error ? err.message : String(err);
  }
  const ran = ranWhile ? `fn ran while ${ranWhile}` : "fn never ran";
  console.log(
    `${label}: ${outcome} (${ran}) -> ${breaker.status}, service calls: ${service.calls}`,
  );
}

await attempt("call 1"); // ok (fn ran while CLOSED) -> CLOSED, failures: 0/3, service calls: 1
service.healthy = false;
await attempt("call 2"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 2
await attempt("call 3"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 3
await attempt("call 4"); // service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 4
await attempt("call 5"); // circuit open, failing fast (fn never ran) -> OPEN, failures: 3/3, service calls: 4

clock.advance(COOLDOWN_MS);
service.healthy = true;
// Nothing has changed yet: Open only notices the elapsed cooldown on the next call.
console.log(`cooldown elapsed -> ${breaker.status}`); // OPEN, failures: 3/3
await attempt("call 6"); // ok (fn ran while HALF_OPEN) -> CLOSED, failures: 0/3, service calls: 5

// Later: a fresh failure streak trips it again, and this time the trial fails too.
service.healthy = false;
await attempt("call 7"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 6
await attempt("call 8"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 7
await attempt("call 9"); // service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 8
clock.advance(COOLDOWN_MS);
await attempt("call 10"); // service unavailable (fn ran while HALF_OPEN) -> OPEN, failures: 3/3, service calls: 9
// [/client]
