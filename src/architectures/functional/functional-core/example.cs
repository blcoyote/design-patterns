using System;
using System.Globalization;

// [test]
// Testing the core needs no mocks, no fake clock class, no in-memory database —
// just values in, a value out, compared with ==/Equals.
var testAccount = new Account("acc-1", "ops@example.com", 4200, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), null);
var testNow = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc);

var testDecision = ReminderPolicy.DecideReminder(testAccount, testNow);
Console.WriteLine($"core test: {testDecision.Action} {testDecision.Effects.Count} effect(s)");
// [/test]

// Usage: the shell wired up with concrete (if deterministic, for this demo) adapters.
var handler = new ReminderHandler(new InMemoryAccounts(testAccount), new FixedClock(testNow), new ConsoleMailer());
handler.Handle("acc-1");

// [domain]
record Account(string Id, string Email, int InvoiceCents, DateTime DueAt, DateTime? LastReminderAt);
// [/domain]

// [effects]
// An effect is a description of something to do in the outside world — not the
// doing of it. The core only ever builds these; it never sends an email itself.
abstract record Effect;
record SendEmail(string To, string Subject, string Body) : Effect;
record MarkReminded(string AccountId, DateTime At) : Effect;

record Decision(string Action, IReadOnlyList<Effect> Effects);
// [/effects]

// [core]
static class ReminderPolicy
{
    const int GraceDays = 3;

    /// <summary>
    /// The pure core. Same (account, now) in, same Decision out, forever — no
    /// DateTime.Now, no database call, no network request hiding inside it. `now`
    /// arrives as a plain value instead of being read from a clock, which is what
    /// makes this testable without mocking time.
    /// </summary>
    public static Decision DecideReminder(Account account, DateTime now)
    {
        var overdue = now - account.DueAt;
        var isOverdue = overdue > TimeSpan.FromDays(GraceDays);
        var remindedToday = account.LastReminderAt is { } last && (now - last) < TimeSpan.FromDays(1);

        if (!isOverdue || remindedToday)
        {
            return new Decision("skip", Array.Empty<Effect>());
        }

        var amount = (account.InvoiceCents / 100.0).ToString("F2", CultureInfo.InvariantCulture);
        return new Decision("remind", new Effect[]
        {
            new SendEmail(account.Email, "Your invoice is overdue", $"Invoice of ${amount} was due {account.DueAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}."),
            new MarkReminded(account.Id, now),
        });
    }
}
// [/core]

// [shell]
interface IAccountStore
{
    Account Load(string id);
    void Save(Account account);
}
interface IClock
{
    DateTime Now();
}
interface IMailer
{
    void Send(string to, string subject, string body);
}

/// <summary>
/// The imperative shell. It gathers plain values (load the account, read the clock),
/// hands them to the pure core, and then interprets whatever effects come back by
/// walking the list and performing the matching I/O — one switch arm per effect type.
/// None of the decision logic lives here; all of the side effects do.
/// </summary>
class ReminderHandler
{
    readonly IAccountStore _accounts;
    readonly IClock _clock;
    readonly IMailer _mailer;

    public ReminderHandler(IAccountStore accounts, IClock clock, IMailer mailer)
    {
        _accounts = accounts;
        _clock = clock;
        _mailer = mailer;
    }

    public Decision Handle(string accountId)
    {
        var account = _accounts.Load(accountId);
        var now = _clock.Now();

        var decision = ReminderPolicy.DecideReminder(account, now);

        foreach (var effect in decision.Effects)
        {
            switch (effect)
            {
                case SendEmail e:
                    _mailer.Send(e.To, e.Subject, e.Body);
                    break;
                case MarkReminded e:
                    _accounts.Save(account with { LastReminderAt = e.At });
                    break;
            }
        }

        return decision;
    }
}
// [/shell]

class InMemoryAccounts : IAccountStore
{
    Account _account;
    public InMemoryAccounts(Account account) => _account = account;
    public Account Load(string id) => _account;
    public void Save(Account updated)
    {
        _account = updated;
        var last = updated.LastReminderAt?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture) ?? "null";
        Console.WriteLine($"saved account {updated.Id} - last reminded {last}");
    }
}

class FixedClock : IClock
{
    readonly DateTime _value;
    public FixedClock(DateTime value) => _value = value;
    public DateTime Now() => _value;
}

class ConsoleMailer : IMailer
{
    public void Send(string to, string subject, string body) => Console.WriteLine($"email -> {to} : {subject}\n  {body}");
}
