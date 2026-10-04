package main

import (
	"fmt"
	"sync"
)

// Domain: a bank account, modeled the event-sourced way. Nothing here is a type with
// mutable fields -- state is always *derived* from the events that happened to it.
// Go has no sum types, so Command and Event are interfaces closed by an unexported
// marker method, and a type switch plays the role of pattern matching.

type Command interface{ isCommand() }

type OpenAccount struct{ Owner string }
type Deposit struct{ Amount int }
type Withdraw struct{ Amount int }

func (OpenAccount) isCommand() {}
func (Deposit) isCommand()     {}
func (Withdraw) isCommand()    {}

type Event interface{ isEvent() }

type AccountOpened struct{ Owner string }
type Deposited struct{ Amount int }
type Withdrawn struct{ Amount int }

func (AccountOpened) isEvent() {}
func (Deposited) isEvent()     {}
func (Withdrawn) isEvent()     {}

// Account is a plain value; evolve returns a modified copy and never mutates its argument.
type Account struct {
	Owner   *string
	Balance int
}

var initial = Account{}

// [evolve]
// evolve(state, event) -> state: a pure, total function with no branch that can fail.
// It only ever applies an event that already happened -- it never judges whether it should have.
func evolve(state Account, event Event) Account {
	switch e := event.(type) {
	case AccountOpened:
		owner := e.Owner
		state.Owner = &owner // state is a copy (passed by value), so the caller's Account is untouched
	case Deposited:
		state.Balance += e.Amount
	case Withdrawn:
		state.Balance -= e.Amount
	}
	return state
}

// [/evolve]

// [decide]
// decide(command, state) -> []Event: the only place business rules live. It looks at the
// *current* state (rebuilt from history) and either returns the events that should happen,
// or returns an error to reject the command. It never mutates anything itself.
func decide(command Command, state Account) ([]Event, error) {
	switch c := command.(type) {
	case OpenAccount:
		if state.Owner != nil {
			return nil, fmt.Errorf("account already open")
		}
		return []Event{AccountOpened{c.Owner}}, nil
	case Deposit:
		return []Event{Deposited{c.Amount}}, nil
	case Withdraw:
		if c.Amount > state.Balance {
			return nil, fmt.Errorf("insufficient funds")
		}
		return []Event{Withdrawn{c.Amount}}, nil
	}
	return nil, fmt.Errorf("unknown command")
}

// [/decide]

// [fold]
// Replay: rebuild current state by folding every event in the stream over evolve,
// starting from initial. This is the only way state ever comes into being -- there is
// no separate "save the current balance" step.
func fold(events []Event) Account {
	state := initial
	for _, event := range events {
		state = evolve(state, event)
	}
	return state
}

// [/fold]

// [append]
// EventStore: an append-only log, keyed by stream id. Append enforces optimistic
// concurrency -- the caller must say which version it last read, and the append is
// rejected if the stream moved on in the meantime.
type EventStore struct {
	mu          sync.Mutex
	streams     map[string][]Event
	subscribers []func(streamID string, event Event)
}

func NewEventStore() *EventStore {
	return &EventStore{streams: map[string][]Event{}}
}

func (s *EventStore) Load(streamID string) []Event {
	s.mu.Lock()
	defer s.mu.Unlock()
	// a copy, so callers cannot mutate the stored history behind Append's back
	return append([]Event(nil), s.streams[streamID]...)
}

func (s *EventStore) Append(streamID string, expectedVersion int, events []Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing := append([]Event(nil), s.streams[streamID]...)
	if len(existing) != expectedVersion {
		return fmt.Errorf("concurrency conflict: expected version %d, found %d", expectedVersion, len(existing))
	}
	s.streams[streamID] = append(existing, events...)
	// Notify while still holding the lock, so subscribers see events in commit order
	// (a subscriber must therefore never append back to this store).
	for _, event := range events {
		for _, subscriber := range s.subscribers {
			subscriber(streamID, event)
		}
	}
	return nil
}

func (s *EventStore) Subscribe(fn func(streamID string, event Event)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscribers = append(s.subscribers, fn)
}

// [/append]

// [snapshot]
// Snapshot: a cached fold result at a known version, so replay does not have to start
// from event zero every time. Taking one never changes behavior, only replay cost.
type Snapshot struct {
	Version int
	State   Account
}

func loadWithSnapshot(store *EventStore, streamID string, snapshot *Snapshot) Account {
	allEvents := store.Load(streamID)
	newEvents := allEvents
	state := initial
	if snapshot != nil {
		newEvents = allEvents[snapshot.Version:]
		state = snapshot.State
	}
	for _, event := range newEvents {
		state = evolve(state, event)
	}
	return state
}

// [/snapshot]

// [projection]
// Projection: a read model that subscribes to the stream and evolves its own shape --
// here, just a running count of withdrawals -- independently of the write-side Account.
type WithdrawalCountProjection struct {
	Count int
}

func (p *WithdrawalCountProjection) Handle(streamID string, event Event) {
	if _, ok := event.(Withdrawn); ok {
		p.Count++
	}
}

// [/projection]

// Usage
const streamID = "account-42"

func main() {
	store := NewEventStore()
	projection := &WithdrawalCountProjection{}
	store.Subscribe(projection.Handle)

	// [handle]
	// The command handler is the imperative shell around the pure core: load the stream,
	// fold it, decide, then append at the version that was loaded. If another writer
	// appended in between, the store sees a different length and rejects the append.
	handle := func(command Command) {
		history := store.Load(streamID)
		state := fold(history)
		events, err := decide(command, state)
		if err != nil {
			panic(err)
		}
		if err := store.Append(streamID, len(history), events); err != nil {
			panic(err)
		}
	}
	// [/handle]

	handle(OpenAccount{"Ada"})
	handle(Deposit{100})
	handle(Withdraw{30})

	fmt.Println("balance:", fold(store.Load(streamID)).Balance)
	fmt.Println("withdrawals so far:", projection.Count)

	// Snapshot avoids replaying from event zero on the next read.
	snapshot := &Snapshot{len(store.Load(streamID)), fold(store.Load(streamID))}
	handle(Deposit{50})
	fmt.Println("balance via snapshot + newer events:", loadWithSnapshot(store, streamID, snapshot).Balance)
}
