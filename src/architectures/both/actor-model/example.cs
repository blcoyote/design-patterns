using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
var system = new ActorSystem();
// Spawn order is the scheduler order. The account is the supervisor's child.
system.Spawn("supervisor", () => new SupervisorActor());
system.Spawn("teller", () => new TellerActor());
system.Spawn("account", () => new AccountActor(), "supervisor");

// Tell only enqueues: nothing has run yet.
system.Tell("account", new Deposit(10000, "teller"));
system.Tell("account", new Withdraw(2500, "teller"));
system.Tell("account", new Withdraw(20000, "teller"));
system.Tell("account", new GetBalance("teller"));
Console.WriteLine($"account mailbox: {system.MailboxSize("account")} messages, none processed yet");
system.Run();

// A bad deposit crashes the account. The supervisor restarts it with a fresh balance, and the
// GetBalance that was already waiting in its mailbox is answered by the new instance.
system.Tell("account", new Deposit(0, "teller"));
system.Tell("account", new GetBalance("teller"));
system.Run();
Console.WriteLine($"account restarts: {system.RestartCount("account")}");
// [/usage]

// [messages]
/// <summary>
/// Everything actors say to each other. An ActorRef is just the actor's name: a string
/// address, like an Erlang PID or an Akka ActorRef (C# has no file-wide type alias here, so
/// the records below simply use string). A sender never holds the actor object, so the only
/// way to reach an actor is to put a message in its mailbox.
/// </summary>
abstract record Message;

/// Money is integer cents everywhere. ReplyTo is where the answer goes: the sender never waits for it.
sealed record Deposit(long AmountCents, string ReplyTo) : Message;

sealed record Withdraw(long AmountCents, string ReplyTo) : Message;

sealed record GetBalance(string ReplyTo) : Message;

sealed record Reply(string Text) : Message;

/// Sent by the system (never by an actor) to a parent when one of its children crashes.
sealed record Failed(string Child, string Reason) : Message;

/// Formats 7500 as "75.00" with integer arithmetic only (no floats, no thousands separator).
static class Money
{
    public static string FormatCents(long cents)
    {
        long whole = cents / 100;
        long fraction = cents % 100;
        return $"{whole.ToString(CultureInfo.InvariantCulture)}.{fraction.ToString("D2", CultureInfo.InvariantCulture)}";
    }
}
// [/messages]

// [actorSystem]
/// What the system hands to an actor while it handles one message.
interface IActorContext
{
    /// This actor's own address.
    string Self { get; }

    /// Puts a message in another actor's mailbox and returns at once.
    void Tell(string to, Message message);

    /// Replaces a crashed child with a fresh instance. Meant for supervisors.
    void Restart(string child);
}

/// <summary>
/// The actor contract. An actor owns its state privately and handles exactly one message per
/// call. A crash is an exception thrown out of Receive: the actor does no defensive handling,
/// its supervisor decides what happens next.
/// </summary>
interface IActor
{
    void Receive(Message message, IActorContext ctx);
}

/// <summary>
/// The actor system: it owns every mailbox and decides when each actor runs.
///
/// Real runtimes (Erlang/OTP schedulers, Akka dispatchers, Orleans silos, Go goroutines plus
/// channels) run many actors concurrently. This scheduler is single-threaded and drains the
/// mailboxes in a fixed order, deterministic only so that this example prints the same output
/// in every language. There are no threads, tasks or timers here.
/// </summary>
class ActorSystem
{
    /// Everything the system keeps for one actor: the actor itself plus its mailbox and bookkeeping.
    private sealed class Cell
    {
        public Cell(string name, Func<IActor> factory, string? parent)
        {
            Name = name;
            Factory = factory;
            Actor = factory();
            Parent = parent;
        }

        public string Name { get; }

        /// How to build a fresh instance, used by Spawn and again by every restart.
        public Func<IActor> Factory { get; }

        public IActor Actor { get; set; }

        /// FIFO: messages are enqueued at the back and dequeued from the front.
        public Queue<Message> Mailbox { get; } = new();

        public string? Parent { get; }

        /// A suspended cell (a crashed actor awaiting its supervisor) is skipped by the scheduler.
        public bool Suspended { get; set; }

        public int Restarts { get; set; }
    }

    private sealed class Context : IActorContext
    {
        private readonly ActorSystem _system;

        public Context(ActorSystem system, string self)
        {
            _system = system;
            Self = self;
        }

        public string Self { get; }

        public void Tell(string to, Message message) => _system.Tell(to, message);

        public void Restart(string child) => _system.Restart(child);
    }

    /// Cells in spawn order: that order is the scheduler order.
    private readonly List<Cell> _cells = new();

    public void Spawn(string name, Func<IActor> factory, string? parent = null)
    {
        _cells.Add(new Cell(name, factory, parent));
    }

    /// Only enqueues. The receiver does not run until the scheduler gives it a turn.
    public void Tell(string to, Message message)
    {
        CellOf(to).Mailbox.Enqueue(message);
    }

    public int MailboxSize(string name) => CellOf(name).Mailbox.Count;

    public int RestartCount(string name) => CellOf(name).Restarts;

    /// <summary>
    /// Runs in rounds until a round processes nothing. A round walks a snapshot of the cells in
    /// spawn order, and every cell that is not suspended and has mail handles exactly ONE
    /// message. That is how "one message at a time per actor" and fair interleaving appear.
    /// </summary>
    public void Run()
    {
        bool processedAny = true;
        while (processedAny)
        {
            processedAny = false;
            foreach (var cell in _cells.ToArray())
            {
                if (cell.Suspended) continue;
                if (!cell.Mailbox.TryDequeue(out var message)) continue;
                processedAny = true;
                Deliver(cell, message);
            }
        }
    }

    private void Deliver(Cell cell, Message message)
    {
        var ctx = new Context(this, cell.Name);
        try
        {
            cell.Actor.Receive(message, ctx);
        }
        catch (Exception ex)
        {
            // The crashed message is dropped (it is not retried) but the rest of the mailbox is kept.
            // The cell is suspended until its supervisor restarts it, and the parent hears about it
            // by message. A cell without a parent just stays suspended.
            cell.Suspended = true;
            if (cell.Parent != null)
            {
                Tell(cell.Parent, new Failed(cell.Name, ex.Message));
            }
        }
    }

    /// A fresh instance from the factory: state starts over, the old instance is simply discarded.
    private void Restart(string child)
    {
        var cell = CellOf(child);
        cell.Actor = cell.Factory();
        cell.Suspended = false;
        cell.Restarts++;
    }

    private Cell CellOf(string name)
    {
        var cell = _cells.FirstOrDefault(candidate => candidate.Name == name);
        if (cell == null) throw new InvalidOperationException($"unknown actor {name}");
        return cell;
    }
}
// [/actorSystem]

// [account]
/// <summary>
/// Owns a balance that nothing else can touch: the only way to read or change it is a message.
/// It never prints; it answers by telling ReplyTo. It also does no defensive handling of a bad
/// deposit: it throws and lets the supervisor deal with it ("let it crash").
/// </summary>
sealed class AccountActor : IActor
{
    private long _balanceCents = 0;

    public void Receive(Message message, IActorContext ctx)
    {
        switch (message)
        {
            case Deposit deposit:
                if (deposit.AmountCents <= 0)
                {
                    throw new InvalidOperationException($"invalid amount {Money.FormatCents(deposit.AmountCents)}");
                }
                _balanceCents += deposit.AmountCents;
                ctx.Tell(deposit.ReplyTo, new Reply(
                    $"deposit {Money.FormatCents(deposit.AmountCents)} ok, balance {Money.FormatCents(_balanceCents)}"));
                return;
            case Withdraw withdraw:
                // Not enough money is a business outcome, so it is a normal reply and not a crash.
                if (withdraw.AmountCents > _balanceCents)
                {
                    ctx.Tell(withdraw.ReplyTo, new Reply(
                        $"withdraw {Money.FormatCents(withdraw.AmountCents)} rejected, balance {Money.FormatCents(_balanceCents)}"));
                    return;
                }
                _balanceCents -= withdraw.AmountCents;
                ctx.Tell(withdraw.ReplyTo, new Reply(
                    $"withdraw {Money.FormatCents(withdraw.AmountCents)} ok, balance {Money.FormatCents(_balanceCents)}"));
                return;
            case GetBalance getBalance:
                ctx.Tell(getBalance.ReplyTo, new Reply($"balance {Money.FormatCents(_balanceCents)}"));
                return;
            default:
                return; // Reply and Failed are not addressed to an account: ignored
        }
    }
}
// [/account]

// [teller]
/// Receives the answers. It is the only actor that prints, and it never touches the account's state.
sealed class TellerActor : IActor
{
    public void Receive(Message message, IActorContext ctx)
    {
        switch (message)
        {
            case Reply reply:
                Console.WriteLine($"[teller] {reply.Text}");
                return;
            default:
                return; // Deposit, Withdraw, GetBalance and Failed are not addressed to a teller: ignored
        }
    }
}
// [/teller]

// [supervisor]
/// <summary>
/// Watches over its children. When one crashes it restarts just that one, leaving its siblings
/// alone: the one-for-one strategy (Erlang's one_for_one). The restarted child starts from
/// scratch, so whatever was only in its memory is gone.
/// </summary>
sealed class SupervisorActor : IActor
{
    public void Receive(Message message, IActorContext ctx)
    {
        switch (message)
        {
            case Failed failed:
                Console.WriteLine($"[supervisor] {failed.Child} crashed ({failed.Reason}), restarting it");
                ctx.Restart(failed.Child);
                return;
            default:
                return; // Deposit, Withdraw, GetBalance and Reply are not addressed to a supervisor: ignored
        }
    }
}
// [/supervisor]
