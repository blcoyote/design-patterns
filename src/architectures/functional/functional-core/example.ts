// [domain]
interface Account {
  readonly id: string;
  readonly email: string;
  readonly invoiceCents: number;
  readonly dueAt: Date;
  readonly lastReminderAt: Date | null;
}
// [/domain]

// [effects]
// An effect is a description of something to do in the outside world — not the
// doing of it. The core only ever builds these; it never sends an email itself.
type Effect =
  | { type: "sendEmail"; to: string; subject: string; body: string }
  | { type: "markReminded"; accountId: string; at: Date };

interface Decision {
  readonly action: "remind" | "skip";
  readonly effects: readonly Effect[];
}
// [/effects]

// [core]
const GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The pure core. Same (account, now) in, same Decision out, forever — no Date.now(),
 * no database call, no network request hiding inside it. `now` arrives as a plain
 * value instead of being read from a clock, which is what makes this testable
 * without mocking time.
 */
function decideReminder(account: Account, now: Date): Decision {
  const overdueMs = now.getTime() - account.dueAt.getTime();
  const isOverdue = overdueMs > GRACE_DAYS * DAY_MS;
  const remindedToday =
    account.lastReminderAt !== null && now.getTime() - account.lastReminderAt.getTime() < DAY_MS;

  if (!isOverdue || remindedToday) {
    return { action: "skip", effects: [] };
  }

  const amount = (account.invoiceCents / 100).toFixed(2);
  return {
    action: "remind",
    effects: [
      {
        type: "sendEmail",
        to: account.email,
        subject: "Your invoice is overdue",
        body: `Invoice of $${amount} was due ${account.dueAt.toISOString().slice(0, 10)}.`,
      },
      { type: "markReminded", accountId: account.id, at: now },
    ],
  };
}
// [/core]

// [shell]
interface AccountStore {
  load(id: string): Account;
  save(account: Account): void;
}
interface Clock {
  now(): Date;
}
interface Mailer {
  send(to: string, subject: string, body: string): void;
}

/**
 * The imperative shell. It gathers plain values (load the account, read the clock),
 * hands them to the pure core, and then interprets whatever effects come back by
 * walking the list and performing the matching I/O — one switch arm per effect type.
 * None of the decision logic lives here; all of the side effects do.
 */
class ReminderHandler {
  constructor(
    private accounts: AccountStore,
    private clock: Clock,
    private mailer: Mailer,
  ) {}

  handle(accountId: string): Decision {
    const account = this.accounts.load(accountId);
    const now = this.clock.now();

    const decision = decideReminder(account, now);

    for (const effect of decision.effects) {
      switch (effect.type) {
        case "sendEmail":
          this.mailer.send(effect.to, effect.subject, effect.body);
          break;
        case "markReminded":
          this.accounts.save({ ...account, lastReminderAt: effect.at });
          break;
      }
    }

    return decision;
  }
}
// [/shell]

// [test]
// Testing the core needs no mocks, no fake clock class, no in-memory database —
// just values in, a value out, compared with ===/deepEqual.
const testAccount: Account = {
  id: "acc-1",
  email: "ops@example.com",
  invoiceCents: 4200,
  dueAt: new Date("2026-09-01T00:00:00Z"),
  lastReminderAt: null,
};
const testNow = new Date("2026-09-10T00:00:00Z");

const testDecision = decideReminder(testAccount, testNow);
console.log("core test:", testDecision.action, testDecision.effects.length, "effect(s)");
// [/test]

// Usage: the shell wired up with concrete (if deterministic, for this demo) adapters.
class InMemoryAccounts implements AccountStore {
  constructor(private account: Account) {}
  load(): Account {
    return this.account;
  }
  save(updated: Account): void {
    this.account = updated;
    console.log(
      "saved account",
      updated.id,
      "- last reminded",
      updated.lastReminderAt?.toISOString() ?? "null",
    );
  }
}
class FixedClock implements Clock {
  constructor(private readonly value: Date) {}
  now(): Date {
    return this.value;
  }
}
class ConsoleMailer implements Mailer {
  send(to: string, subject: string, body: string): void {
    console.log(`email -> ${to} : ${subject}\n  ${body}`);
  }
}

const handler = new ReminderHandler(
  new InMemoryAccounts(testAccount),
  new FixedClock(testNow),
  new ConsoleMailer(),
);
handler.handle("acc-1");
