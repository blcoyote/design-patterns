// [sleeper]
/** A fake sleeper: sleep() only adds up the time, nothing really waits. */
class FakeSleeper {
  totalMs = 0;

  sleep(ms: number): void {
    this.totalMs += ms;
  }
}
// [/sleeper]

// [jitter]
/**
 * Scripted jitter, so the output is the same on every run: percentages 0-100 handed out
 * in order and never reset. A real client draws them at random (full jitter is a uniform
 * pick between 0 and the ceiling).
 */
class ScriptedJitter {
  private next = 0;

  constructor(private readonly percents: number[]) {}

  nextPercent(): number {
    return this.percents[this.next++ % this.percents.length];
  }
}
// [/jitter]

// [service]
class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

/** GET /inventory (idempotent). The script lists the status of each call; the last one repeats. */
class FlakyService {
  private calls = 0;

  constructor(private readonly script: number[]) {}

  get(): string {
    const status = this.script[Math.min(this.calls++, this.script.length - 1)];
    if (status >= 400) {
      throw new ApiError(status);
    }
    return "inventory: 12 items";
  }
}
// [/service]

// [policy]
class RetryPolicy {
  constructor(
    readonly maxAttempts: number,
    readonly baseMs: number,
    readonly capMs: number,
  ) {}

  /** Exponential backoff: base, 2 x base, 4 x base ..., never above the cap. */
  ceilingMs(attempt: number): number {
    return Math.min(this.capMs, this.baseMs * 2 ** (attempt - 1));
  }
}
// [/policy]

interface Outcome {
  ok: boolean;
  attempts: number;
  waitedMs: number;
  status: number;
}

// [retrier]
class Retrier {
  constructor(
    private readonly policy: RetryPolicy,
    private readonly jitter: ScriptedJitter,
    private readonly sleeper: FakeSleeper,
  ) {}

  execute(fn: () => string): Outcome {
    const sleptBefore = this.sleeper.totalMs;
    const outcome = (ok: boolean, attempts: number, status: number): Outcome => ({
      ok,
      attempts,
      waitedMs: this.sleeper.totalMs - sleptBefore,
      status,
    });

    for (let attempt = 1; ; attempt++) {
      // [attempt]
      try {
        fn();
        console.log(`attempt ${attempt}: ok`);
        return outcome(true, attempt, 200);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        // [classify]
        // This example treats every status below 500 as final; real policies also retry 408 and 429.
        if (err.status < 500) {
          console.log(`attempt ${attempt}: ${err.status} -> not retryable`);
          return outcome(false, attempt, err.status);
        }
        // [/classify]
        // [giveUp]
        if (attempt === this.policy.maxAttempts) {
          console.log(`attempt ${attempt}: ${err.status} -> giving up`);
          return outcome(false, attempt, err.status);
        }
        // [/giveUp]
        // [wait]
        const ceiling = this.policy.ceilingMs(attempt);
        const delay = Math.floor((ceiling * this.jitter.nextPercent()) / 100);
        console.log(
          `attempt ${attempt}: ${err.status} -> retry in ${delay}ms (ceiling ${ceiling}ms)`,
        );
        this.sleeper.sleep(delay);
        // [/wait]
      }
      // [/attempt]
    }
  }
}
// [/retrier]

// [client]
// Usage
function describe(o: Outcome): string {
  const tail = `attempts ${o.attempts}, waited ${o.waitedMs}ms`;
  if (o.ok) return `ok, ${tail}`;
  if (o.status >= 500) return `gave up (${o.status}), ${tail}`;
  return `failed (${o.status}, not retryable), ${tail}`;
}

const retrier = new Retrier(
  new RetryPolicy(/* maxAttempts */ 4, /* baseMs */ 100, /* capMs */ 400),
  new ScriptedJitter([50, 25, 75, 40, 90, 10]),
  new FakeSleeper(),
);

function call(title: string, script: number[]): void {
  console.log(`--- ${title} ---`);
  const service = new FlakyService(script);
  console.log(`result: ${describe(retrier.execute(() => service.get()))}`);
}

call("call 1: succeeds on attempt 4", [503, 503, 503, 200]);
call("call 2: always fails", [503]);
call("call 3: bad request", [400]);
// [/client]
