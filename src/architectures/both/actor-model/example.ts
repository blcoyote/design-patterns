// [messages]
/**
 * Everything actors say to each other. An ActorRef is just the actor's name: a string
 * address, like an Erlang PID or an Akka ActorRef. A sender never holds the actor object,
 * so the only way to reach an actor is to put a message in its mailbox.
 */
type ActorRef = string;

/** Money is integer cents everywhere. replyTo is where the answer goes: the sender never waits for it. */
type Message =
  | { kind: "Deposit"; amountCents: number; replyTo: ActorRef }
  | { kind: "Withdraw"; amountCents: number; replyTo: ActorRef }
  | { kind: "GetBalance"; replyTo: ActorRef }
  | { kind: "Reply"; text: string }
  /** Sent by the system (never by an actor) to a parent when one of its children crashes. */
  | { kind: "Failed"; child: ActorRef; reason: string };

/** Formats 7500 as "75.00" with integer arithmetic only (no floats, no thousands separator). */
function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}
// [/messages]

// [actorSystem]
/** What the system hands to an actor while it handles one message. */
interface ActorContext {
  /** This actor's own address. */
  readonly self: ActorRef;
  /** Puts a message in another actor's mailbox and returns at once. */
  tell(to: ActorRef, message: Message): void;
  /** Replaces a crashed child with a fresh instance. Meant for supervisors. */
  restart(child: ActorRef): void;
}

/**
 * The actor contract. An actor owns its state privately and handles exactly one message per
 * call. A crash is an exception thrown out of receive: the actor does no defensive handling,
 * its supervisor decides what happens next.
 */
interface Actor {
  receive(message: Message, ctx: ActorContext): void;
}

/** Everything the system keeps for one actor: the actor itself plus its mailbox and bookkeeping. */
interface Cell {
  readonly name: ActorRef;
  /** How to build a fresh instance, used by spawn and again by every restart. */
  readonly factory: () => Actor;
  actor: Actor;
  /** FIFO: messages are pushed at the back and shifted from the front. */
  readonly mailbox: Message[];
  readonly parent: ActorRef | undefined;
  /** A suspended cell (a crashed actor awaiting its supervisor) is skipped by the scheduler. */
  suspended: boolean;
  restarts: number;
}

/**
 * The actor system: it owns every mailbox and decides when each actor runs.
 *
 * Real runtimes (Erlang/OTP schedulers, Akka dispatchers, Orleans silos, Go goroutines plus
 * channels) run many actors concurrently. This scheduler is single-threaded and drains the
 * mailboxes in a fixed order, deterministic only so that this example prints the same output
 * in every language. There are no threads, tasks or timers here.
 */
class ActorSystem {
  /** Cells in spawn order: that order is the scheduler order. */
  private readonly cells: Cell[] = [];

  spawn(name: ActorRef, factory: () => Actor, parent?: ActorRef): void {
    this.cells.push({
      name,
      factory,
      actor: factory(),
      mailbox: [],
      parent,
      suspended: false,
      restarts: 0,
    });
  }

  /** Only enqueues. The receiver does not run until the scheduler gives it a turn. */
  tell(to: ActorRef, message: Message): void {
    this.cellOf(to).mailbox.push(message);
  }

  mailboxSize(name: ActorRef): number {
    return this.cellOf(name).mailbox.length;
  }

  restartCount(name: ActorRef): number {
    return this.cellOf(name).restarts;
  }

  /**
   * Runs in rounds until a round processes nothing. A round walks a snapshot of the cells in
   * spawn order, and every cell that is not suspended and has mail handles exactly ONE
   * message. That is how "one message at a time per actor" and fair interleaving appear.
   */
  run(): void {
    let processedAny = true;
    while (processedAny) {
      processedAny = false;
      for (const cell of [...this.cells]) {
        if (cell.suspended) continue;
        const message = cell.mailbox.shift();
        if (message === undefined) continue;
        processedAny = true;
        this.deliver(cell, message);
      }
    }
  }

  private deliver(cell: Cell, message: Message): void {
    const ctx: ActorContext = {
      self: cell.name,
      tell: (to, next) => this.tell(to, next),
      restart: (child) => this.restart(child),
    };
    try {
      cell.actor.receive(message, ctx);
    } catch (err) {
      // The crashed message is dropped (it is not retried) but the rest of the mailbox is kept.
      // The cell is suspended until its supervisor restarts it, and the parent hears about it
      // by message. A cell without a parent just stays suspended.
      cell.suspended = true;
      if (cell.parent !== undefined) {
        const reason = err instanceof Error ? err.message : String(err);
        this.tell(cell.parent, { kind: "Failed", child: cell.name, reason });
      }
    }
  }

  /** A fresh instance from the factory: state starts over, the old instance is simply discarded. */
  private restart(child: ActorRef): void {
    const cell = this.cellOf(child);
    cell.actor = cell.factory();
    cell.suspended = false;
    cell.restarts++;
  }

  private cellOf(name: ActorRef): Cell {
    const cell = this.cells.find((candidate) => candidate.name === name);
    if (cell === undefined) throw new Error(`unknown actor ${name}`);
    return cell;
  }
}
// [/actorSystem]

// [account]
/**
 * Owns a balance that nothing else can touch: the only way to read or change it is a message.
 * It never prints; it answers by telling replyTo. It also does no defensive handling of a bad
 * deposit: it throws and lets the supervisor deal with it ("let it crash").
 */
class AccountActor implements Actor {
  private balanceCents = 0;

  receive(message: Message, ctx: ActorContext): void {
    switch (message.kind) {
      case "Deposit": {
        if (message.amountCents <= 0) {
          throw new Error(`invalid amount ${formatCents(message.amountCents)}`);
        }
        this.balanceCents += message.amountCents;
        ctx.tell(message.replyTo, {
          kind: "Reply",
          text: `deposit ${formatCents(message.amountCents)} ok, balance ${formatCents(this.balanceCents)}`,
        });
        return;
      }
      case "Withdraw": {
        // Not enough money is a business outcome, so it is a normal reply and not a crash.
        if (message.amountCents > this.balanceCents) {
          ctx.tell(message.replyTo, {
            kind: "Reply",
            text: `withdraw ${formatCents(message.amountCents)} rejected, balance ${formatCents(this.balanceCents)}`,
          });
          return;
        }
        this.balanceCents -= message.amountCents;
        ctx.tell(message.replyTo, {
          kind: "Reply",
          text: `withdraw ${formatCents(message.amountCents)} ok, balance ${formatCents(this.balanceCents)}`,
        });
        return;
      }
      case "GetBalance": {
        ctx.tell(message.replyTo, {
          kind: "Reply",
          text: `balance ${formatCents(this.balanceCents)}`,
        });
        return;
      }
      case "Reply":
      case "Failed":
        return; // not addressed to an account: ignored
    }
  }
}
// [/account]

// [teller]
/** Receives the answers. It is the only actor that prints, and it never touches the account's state. */
class TellerActor implements Actor {
  receive(message: Message): void {
    switch (message.kind) {
      case "Reply":
        console.log(`[teller] ${message.text}`);
        return;
      case "Deposit":
      case "Withdraw":
      case "GetBalance":
      case "Failed":
        return; // not addressed to a teller: ignored
    }
  }
}
// [/teller]

// [supervisor]
/**
 * Watches over its children. When one crashes it restarts just that one, leaving its siblings
 * alone: the one-for-one strategy (Erlang's one_for_one). The restarted child starts from
 * scratch, so whatever was only in its memory is gone.
 */
class SupervisorActor implements Actor {
  receive(message: Message, ctx: ActorContext): void {
    switch (message.kind) {
      case "Failed":
        console.log(`[supervisor] ${message.child} crashed (${message.reason}), restarting it`);
        ctx.restart(message.child);
        return;
      case "Deposit":
      case "Withdraw":
      case "GetBalance":
      case "Reply":
        return; // not addressed to a supervisor: ignored
    }
  }
}
// [/supervisor]

// [usage]
const system = new ActorSystem();
// Spawn order is the scheduler order. The account is the supervisor's child.
system.spawn("supervisor", () => new SupervisorActor());
system.spawn("teller", () => new TellerActor());
system.spawn("account", () => new AccountActor(), "supervisor");

// tell only enqueues: nothing has run yet.
system.tell("account", { kind: "Deposit", amountCents: 10000, replyTo: "teller" });
system.tell("account", { kind: "Withdraw", amountCents: 2500, replyTo: "teller" });
system.tell("account", { kind: "Withdraw", amountCents: 20000, replyTo: "teller" });
system.tell("account", { kind: "GetBalance", replyTo: "teller" });
console.log(`account mailbox: ${system.mailboxSize("account")} messages, none processed yet`);
system.run();

// A bad deposit crashes the account. The supervisor restarts it with a fresh balance, and the
// GetBalance that was already waiting in its mailbox is answered by the new instance.
system.tell("account", { kind: "Deposit", amountCents: 0, replyTo: "teller" });
system.tell("account", { kind: "GetBalance", replyTo: "teller" });
system.run();
console.log(`account restarts: ${system.restartCount("account")}`);
// [/usage]
