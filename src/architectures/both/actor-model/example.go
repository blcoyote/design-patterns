package main

import "fmt"

// [messages]
// ActorRef is just the actor's name: a string address, like an Erlang PID or an Akka ActorRef.
// A sender never holds the actor object, so the only way to reach an actor is to put a message
// in its mailbox.
type ActorRef string

// Message is everything actors say to each other. Money is integer cents everywhere. ReplyTo is
// where the answer goes: the sender never waits for it. The unexported marker method closes the
// set to the five kinds below, and actors tell them apart with a type switch.
type Message interface{ isMessage() }

type Deposit struct {
	AmountCents int
	ReplyTo     ActorRef
}

type Withdraw struct {
	AmountCents int
	ReplyTo     ActorRef
}

type GetBalance struct {
	ReplyTo ActorRef
}

type Reply struct {
	Text string
}

// Failed is sent by the system (never by an actor) to a parent when one of its children crashes.
type Failed struct {
	Child  ActorRef
	Reason string
}

func (Deposit) isMessage()    {}
func (Withdraw) isMessage()   {}
func (GetBalance) isMessage() {}
func (Reply) isMessage()      {}
func (Failed) isMessage()     {}

// formatCents formats 7500 as "75.00" and -2500 as "-25.00" with integer arithmetic only (no floats, no thousands separator).
func formatCents(cents int) string {
	sign := ""
	absolute := cents
	if cents < 0 {
		sign = "-"
		absolute = -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, absolute/100, absolute%100)
}

// [/messages]

// [actorSystem]
// ActorContext is what the system hands to an actor while it handles one message.
type ActorContext interface {
	// Self is this actor's own address.
	Self() ActorRef
	// Tell puts a message in another actor's mailbox and returns at once.
	Tell(to ActorRef, message Message)
	// Restart replaces a crashed child with a fresh instance. Meant for supervisors.
	Restart(child ActorRef)
}

// Actor is the actor contract. An actor owns its state privately and handles exactly one message
// per call. A crash is an error returned from Receive: the actor does no defensive handling, its
// supervisor decides what happens next. Erlang and Akka actors crash by throwing; returning an
// error is Go's idiom for the same thing.
type Actor interface {
	Receive(message Message, ctx ActorContext) error
}

// cell is everything the system keeps for one actor: the actor itself plus its mailbox and bookkeeping.
type cell struct {
	name ActorRef
	// factory builds a fresh instance, used by Spawn and again by every restart.
	factory func() Actor
	actor   Actor
	// mailbox is FIFO: messages are appended at the back and taken from the front.
	mailbox []Message
	// parent is "" when the actor has no parent.
	parent ActorRef
	// suspended marks a crashed actor awaiting its supervisor: the scheduler skips it.
	suspended bool
	restarts  int
}

// ActorSystem owns every mailbox and decides when each actor runs.
//
// Real runtimes (Erlang/OTP schedulers, Akka dispatchers, Orleans silos) run many actors
// concurrently, and idiomatic Go would give each actor a goroutine and a channel as its mailbox.
// This example deliberately doesn't: its scheduler is single-threaded and drains the mailboxes
// in a fixed order, deterministic only so that it prints the same output in every language.
// There are no goroutines, channels, tasks or timers here.
type ActorSystem struct {
	// cells are in spawn order: that order is the scheduler order.
	cells []*cell
}

func NewActorSystem() *ActorSystem {
	return &ActorSystem{}
}

// Spawn registers an actor built by factory. A parent of "" means no parent.
func (s *ActorSystem) Spawn(name ActorRef, factory func() Actor, parent ActorRef) {
	s.cells = append(s.cells, &cell{
		name:    name,
		factory: factory,
		actor:   factory(),
		parent:  parent,
	})
}

// Tell only enqueues. The receiver does not run until the scheduler gives it a turn.
func (s *ActorSystem) Tell(to ActorRef, message Message) {
	c := s.cellOf(to)
	c.mailbox = append(c.mailbox, message)
}

func (s *ActorSystem) MailboxSize(name ActorRef) int {
	return len(s.cellOf(name).mailbox)
}

func (s *ActorSystem) RestartCount(name ActorRef) int {
	return s.cellOf(name).restarts
}

// Run runs in rounds until a round processes nothing. A round walks a snapshot of the cells in
// spawn order, and every cell that is not suspended and has mail handles exactly ONE message.
// That is how "one message at a time per actor" and fair interleaving appear.
func (s *ActorSystem) Run() {
	processedAny := true
	for processedAny {
		processedAny = false
		// range evaluates its operand once anyway; the explicit copy makes the snapshot visible.
		snapshot := append([]*cell(nil), s.cells...)
		for _, c := range snapshot {
			if c.suspended {
				continue
			}
			if len(c.mailbox) == 0 {
				continue
			}
			message := c.mailbox[0]
			c.mailbox = c.mailbox[1:]
			processedAny = true
			s.deliver(c, message)
		}
	}
}

// actorContext is the ActorContext value handed to an actor for one message.
type actorContext struct {
	system *ActorSystem
	self   ActorRef
}

func (a actorContext) Self() ActorRef                    { return a.self }
func (a actorContext) Tell(to ActorRef, message Message) { a.system.Tell(to, message) }
func (a actorContext) Restart(child ActorRef)            { a.system.restart(child) }

func (s *ActorSystem) deliver(c *cell, message Message) {
	err := c.actor.Receive(message, actorContext{system: s, self: c.name})
	if err != nil {
		// The crashed message is dropped (it is not retried) but the rest of the mailbox is kept.
		// The cell is suspended until its supervisor restarts it, and the parent hears about it
		// by message. A cell without a parent just stays suspended.
		c.suspended = true
		if c.parent != "" {
			s.Tell(c.parent, Failed{Child: c.name, Reason: err.Error()})
		}
	}
}

// restart gives the cell a fresh instance from the factory: state starts over, the old instance
// is simply discarded.
func (s *ActorSystem) restart(child ActorRef) {
	c := s.cellOf(child)
	c.actor = c.factory()
	c.suspended = false
	c.restarts++
}

func (s *ActorSystem) cellOf(name ActorRef) *cell {
	for _, candidate := range s.cells {
		if candidate.name == name {
			return candidate
		}
	}
	// An unknown name is a programmer bug, not a runtime condition an actor could handle.
	panic(fmt.Sprintf("unknown actor %s", name))
}

// [/actorSystem]

// [account]
// AccountActor owns a balance that nothing else can touch: the only way to read or change it is
// a message. It never prints; it answers by telling ReplyTo. It also does no defensive handling
// of a bad amount (a deposit or withdrawal of 0 or less): it returns an error and lets the supervisor deal with it ("let it crash").
type AccountActor struct {
	balanceCents int
}

func (a *AccountActor) Receive(message Message, ctx ActorContext) error {
	switch m := message.(type) {
	case Deposit:
		if m.AmountCents <= 0 {
			return fmt.Errorf("invalid amount %s", formatCents(m.AmountCents))
		}
		a.balanceCents += m.AmountCents
		ctx.Tell(m.ReplyTo, Reply{Text: fmt.Sprintf("deposit %s ok, balance %s", formatCents(m.AmountCents), formatCents(a.balanceCents))})
	case Withdraw:
		if m.AmountCents <= 0 {
			return fmt.Errorf("invalid amount %s", formatCents(m.AmountCents))
		}
		// Not enough money is a business outcome, so it is a normal reply and not a crash.
		if m.AmountCents > a.balanceCents {
			ctx.Tell(m.ReplyTo, Reply{Text: fmt.Sprintf("withdraw %s rejected, balance %s", formatCents(m.AmountCents), formatCents(a.balanceCents))})
			return nil
		}
		a.balanceCents -= m.AmountCents
		ctx.Tell(m.ReplyTo, Reply{Text: fmt.Sprintf("withdraw %s ok, balance %s", formatCents(m.AmountCents), formatCents(a.balanceCents))})
	case GetBalance:
		ctx.Tell(m.ReplyTo, Reply{Text: fmt.Sprintf("balance %s", formatCents(a.balanceCents))})
	case Reply, Failed:
		// not addressed to an account: ignored
	}
	return nil
}

// [/account]

// [teller]
// TellerActor receives the answers. It is the only actor that prints, and it never touches the account's state.
type TellerActor struct{}

func (*TellerActor) Receive(message Message, ctx ActorContext) error {
	switch m := message.(type) {
	case Reply:
		fmt.Printf("[teller] %s\n", m.Text)
	case Deposit, Withdraw, GetBalance, Failed:
		// not addressed to a teller: ignored
	}
	return nil
}

// [/teller]

// [supervisor]
// SupervisorActor watches over its children. When one crashes it restarts just that one, leaving
// its siblings alone: the one-for-one strategy (Erlang's one_for_one). The restarted child starts
// from scratch, so whatever was only in its memory is gone.
type SupervisorActor struct{}

func (*SupervisorActor) Receive(message Message, ctx ActorContext) error {
	switch m := message.(type) {
	case Failed:
		fmt.Printf("[supervisor] %s crashed (%s), restarting it\n", m.Child, m.Reason)
		ctx.Restart(m.Child)
	case Deposit, Withdraw, GetBalance, Reply:
		// not addressed to a supervisor: ignored
	}
	return nil
}

// [/supervisor]

// [usage]
func main() {
	system := NewActorSystem()
	// Spawn order is the scheduler order. The account is the supervisor's child.
	system.Spawn("supervisor", func() Actor { return &SupervisorActor{} }, "")
	system.Spawn("teller", func() Actor { return &TellerActor{} }, "")
	system.Spawn("account", func() Actor { return &AccountActor{} }, "supervisor")

	// Tell only enqueues: nothing has run yet.
	system.Tell("account", Deposit{AmountCents: 10000, ReplyTo: "teller"})
	system.Tell("account", Withdraw{AmountCents: 2500, ReplyTo: "teller"})
	system.Tell("account", Withdraw{AmountCents: 20000, ReplyTo: "teller"})
	system.Tell("account", GetBalance{ReplyTo: "teller"})
	fmt.Printf("account mailbox: %d messages, none processed yet\n", system.MailboxSize("account"))
	system.Run()

	// A bad deposit crashes the account. The supervisor restarts it with a fresh balance, and the
	// GetBalance that was already waiting in its mailbox is answered by the new instance.
	system.Tell("account", Deposit{AmountCents: 0, ReplyTo: "teller"})
	system.Tell("account", GetBalance{ReplyTo: "teller"})
	system.Run()
	fmt.Printf("account restarts: %d\n", system.RestartCount("account"))
}

// [/usage]
