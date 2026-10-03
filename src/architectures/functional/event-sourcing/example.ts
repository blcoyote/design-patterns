// Domain: a bank account, modeled the event-sourced way. Nothing here is a class with
// mutable fields — state is always *derived* from the events that happened to it.

type Command =
  | { type: "OpenAccount"; owner: string }
  | { type: "Deposit"; amount: number }
  | { type: "Withdraw"; amount: number };

type Event =
  | { type: "AccountOpened"; owner: string }
  | { type: "Deposited"; amount: number }
  | { type: "Withdrawn"; amount: number };

interface Account {
  owner: string | null;
  balance: number;
}

const initial: Account = { owner: null, balance: 0 };

// [evolve]
// evolve(state, event) -> state: a pure, total function with no branch that can fail.
// It only ever applies an event that already happened — it never judges whether it should have.
function evolve(state: Account, event: Event): Account {
  switch (event.type) {
    case "AccountOpened":
      return { ...state, owner: event.owner };
    case "Deposited":
      return { ...state, balance: state.balance + event.amount };
    case "Withdrawn":
      return { ...state, balance: state.balance - event.amount };
  }
}
// [/evolve]

// [decide]
// decide(command, state) -> Event[]: the only place business rules live. It looks at the
// *current* state (rebuilt from history) and either returns the events that should happen,
// or throws to reject the command. It never mutates anything itself.
function decide(command: Command, state: Account): Event[] {
  switch (command.type) {
    case "OpenAccount":
      if (state.owner) throw new Error("account already open");
      return [{ type: "AccountOpened", owner: command.owner }];
    case "Deposit":
      return [{ type: "Deposited", amount: command.amount }];
    case "Withdraw":
      if (command.amount > state.balance) throw new Error("insufficient funds");
      return [{ type: "Withdrawn", amount: command.amount }];
  }
}
// [/decide]

// [fold]
// Replay: rebuild current state by folding every event in the stream over `evolve`,
// starting from `initial`. This is the only way state ever comes into being — there is
// no separate "save the current balance" step.
function fold(events: Event[]): Account {
  return events.reduce(evolve, initial);
}
// [/fold]

// [append]
// EventStore: an append-only log, keyed by stream id. `append` enforces optimistic
// concurrency — the caller must say which version it last read, and the append is
// rejected if the stream moved on in the meantime.
class EventStore {
  private streams = new Map<string, Event[]>();
  private subscribers: ((streamId: string, event: Event) => void)[] = [];

  load(streamId: string): Event[] {
    // a copy, so callers cannot mutate the stored history behind append()'s back
    return [...(this.streams.get(streamId) ?? [])];
  }

  append(streamId: string, expectedVersion: number, events: Event[]): void {
    const existing = this.load(streamId);
    if (existing.length !== expectedVersion) {
      throw new Error(
        `concurrency conflict: expected version ${expectedVersion}, found ${existing.length}`,
      );
    }
    const updated = [...existing, ...events];
    this.streams.set(streamId, updated);
    for (const event of events) {
      for (const subscriber of this.subscribers) subscriber(streamId, event);
    }
  }

  subscribe(fn: (streamId: string, event: Event) => void): void {
    this.subscribers.push(fn);
  }
}
// [/append]

// [snapshot]
// Snapshot: a cached fold result at a known version, so replay does not have to start
// from event zero every time. Taking one never changes behavior, only replay cost.
interface Snapshot {
  version: number;
  state: Account;
}

function loadWithSnapshot(store: EventStore, streamId: string, snapshot: Snapshot | null): Account {
  const allEvents = store.load(streamId);
  const newEvents = snapshot ? allEvents.slice(snapshot.version) : allEvents;
  return newEvents.reduce(evolve, snapshot ? snapshot.state : initial);
}
// [/snapshot]

// [projection]
// Projection: a read model that subscribes to the stream and evolves its own shape —
// here, just a running count of withdrawals — independently of the write-side Account.
class WithdrawalCountProjection {
  count = 0;

  handle(_streamId: string, event: Event): void {
    if (event.type === "Withdrawn") this.count += 1;
  }
}
// [/projection]

// Usage
const store = new EventStore();
const projection = new WithdrawalCountProjection();
store.subscribe((streamId, event) => projection.handle(streamId, event));

const streamId = "account-42";

function handle(command: Command): void {
  const state = fold(store.load(streamId));
  const events = decide(command, state);
  store.append(streamId, store.load(streamId).length, events);
}

handle({ type: "OpenAccount", owner: "Ada" });
handle({ type: "Deposit", amount: 100 });
handle({ type: "Withdraw", amount: 30 });

console.log("balance:", fold(store.load(streamId)).balance);
console.log("withdrawals so far:", projection.count);

// Snapshot avoids replaying from event zero on the next read.
const snapshot: Snapshot = {
  version: store.load(streamId).length,
  state: fold(store.load(streamId)),
};
handle({ type: "Deposit", amount: 50 });
console.log(
  "balance via snapshot + newer events:",
  loadWithSnapshot(store, streamId, snapshot).balance,
);
