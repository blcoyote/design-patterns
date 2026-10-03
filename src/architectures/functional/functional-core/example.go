package main

import (
	"fmt"
	"time"
)

// [domain]
type Account struct {
	ID             string
	Email          string
	InvoiceCents   int
	DueAt          time.Time
	LastReminderAt *time.Time // nil means "never reminded"
}

// [/domain]

// [effects]
// An effect is a description of something to do in the outside world -- not the
// doing of it. The core only ever builds these; it never sends an email itself.
// Go has no sum types, so Effect is an interface closed by an unexported marker method.
type Effect interface{ isEffect() }

type SendEmail struct {
	To      string
	Subject string
	Body    string
}

type MarkReminded struct {
	AccountID string
	At        time.Time
}

func (SendEmail) isEffect()    {}
func (MarkReminded) isEffect() {}

type Decision struct {
	Action  string
	Effects []Effect
}

// [/effects]

// [core]
const graceDays = 3

// decideReminder is the pure core. Same (account, now) in, same Decision out, forever --
// no time.Now(), no database call, no network request hiding inside it. `now` arrives
// as a plain value instead of being read from a clock, which is what makes this
// testable without mocking time.
func decideReminder(account Account, now time.Time) Decision {
	overdue := now.Sub(account.DueAt)
	isOverdue := overdue > graceDays*24*time.Hour
	remindedToday := account.LastReminderAt != nil && now.Sub(*account.LastReminderAt) < 24*time.Hour

	if !isOverdue || remindedToday {
		return Decision{Action: "skip", Effects: nil}
	}

	amount := fmt.Sprintf("%d.%02d", account.InvoiceCents/100, account.InvoiceCents%100)
	return Decision{
		Action: "remind",
		Effects: []Effect{
			SendEmail{
				To:      account.Email,
				Subject: "Your invoice is overdue",
				Body:    fmt.Sprintf("Invoice of $%s was due %s.", amount, account.DueAt.Format("2006-01-02")),
			},
			MarkReminded{AccountID: account.ID, At: now},
		},
	}
}

// [/core]

// [shell]
type AccountStore interface {
	Load(id string) Account
	Save(account Account)
}

type Clock interface {
	Now() time.Time
}

type Mailer interface {
	Send(to, subject, body string)
}

// ReminderHandler is the imperative shell. It gathers plain values (load the account,
// read the clock), hands them to the pure core, and then interprets whatever effects
// come back by walking the list and performing the matching I/O -- one type-switch
// case per effect type. None of the decision logic lives here; all of the side
// effects do.
type ReminderHandler struct {
	accounts AccountStore
	clock    Clock
	mailer   Mailer
}

func NewReminderHandler(accounts AccountStore, clock Clock, mailer Mailer) *ReminderHandler {
	return &ReminderHandler{accounts: accounts, clock: clock, mailer: mailer}
}

func (h *ReminderHandler) Handle(accountID string) Decision {
	account := h.accounts.Load(accountID)
	now := h.clock.Now()

	decision := decideReminder(account, now)

	for _, effect := range decision.Effects {
		switch e := effect.(type) {
		case SendEmail:
			h.mailer.Send(e.To, e.Subject, e.Body)
		case MarkReminded:
			at := e.At
			updated := account // a copy: Account is passed and assigned by value
			updated.LastReminderAt = &at
			h.accounts.Save(updated)
		}
	}

	return decision
}

// [/shell]

// [test]
// Testing the core needs no mocks, no fake clock type, no in-memory database --
// just values in, a value out, compared with reflect.DeepEqual (Decision holds a
// slice, so == does not compile on it).
var testAccount = Account{
	ID:             "acc-1",
	Email:          "ops@example.com",
	InvoiceCents:   4200,
	DueAt:          time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
	LastReminderAt: nil,
}
var testNow = time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)

func runCoreTest() {
	testDecision := decideReminder(testAccount, testNow)
	fmt.Println("core test:", testDecision.Action, len(testDecision.Effects), "effect(s)")
}

// [/test]

// Usage: the shell wired up with concrete (if deterministic, for this demo) adapters.
type InMemoryAccounts struct {
	account Account
}

func (a *InMemoryAccounts) Load(id string) Account { return a.account }

func (a *InMemoryAccounts) Save(updated Account) {
	a.account = updated
	stamp := "null"
	if updated.LastReminderAt != nil {
		stamp = updated.LastReminderAt.UTC().Format("2006-01-02T15:04:05.000Z")
	}
	fmt.Println("saved account", updated.ID, "- last reminded", stamp)
}

type FixedClock struct {
	value time.Time
}

func (c FixedClock) Now() time.Time { return c.value }

type ConsoleMailer struct{}

func (ConsoleMailer) Send(to, subject, body string) {
	fmt.Printf("email -> %s : %s\n  %s\n", to, subject, body)
}

func main() {
	runCoreTest()
	handler := NewReminderHandler(&InMemoryAccounts{account: testAccount}, FixedClock{testNow}, ConsoleMailer{})
	handler.Handle("acc-1")
}
