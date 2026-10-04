package main

import (
	"errors"
	"fmt"
	"sync"
)

// [clock]
// Clock is a fake clock: time only moves when the usage code calls Advance. No real time anywhere.
type Clock struct {
	NowMs int64
}

func (c *Clock) Advance(ms int64) {
	c.NowMs += ms
}

// [/clock]

// [service]
// RemoteService is a downstream dependency that can start failing under load.
type RemoteService struct {
	Healthy bool // flipped by the usage code to simulate an outage and a recovery
	Calls   int
}

func (s *RemoteService) Request() (string, error) {
	s.Calls++
	if !s.Healthy {
		return "", errors.New("service unavailable")
	}
	return "ok", nil
}

// [/service]

type BreakerState int

const (
	Closed BreakerState = iota
	Open
	HalfOpen
)

func (s BreakerState) String() string {
	switch s {
	case Closed:
		return "CLOSED"
	case Open:
		return "OPEN"
	default:
		return "HALF_OPEN"
	}
}

// [breaker]
// CircuitBreaker's state is guarded by a mutex because Go callers may run in
// several goroutines. (TS and Python rely on a single-threaded event loop; C#
// locks too.) The mutex is never held while fn runs, so a slow call blocks nobody.
type CircuitBreaker struct {
	mu               sync.Mutex
	clock            *Clock
	failureThreshold int
	cooldownMs       int64
	state            BreakerState
	failureCount     int
	nextAttempt      int64
	trialInFlight    bool
	// Bumped whenever the breaker opens or enters Half-Open, so a slow call that
	// started in an earlier state can't drive a transition it never observed.
	generation int
}

func NewCircuitBreaker(clock *Clock, failureThreshold int, cooldownMs int64) *CircuitBreaker {
	return &CircuitBreaker{clock: clock, failureThreshold: failureThreshold, cooldownMs: cooldownMs, state: Closed}
}

// State and Status are read-only views for the usage printout.
func (b *CircuitBreaker) State() BreakerState {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.state
}

func (b *CircuitBreaker) Status() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return fmt.Sprintf("%s, failures: %d/%d", b.state, b.failureCount, b.failureThreshold)
}

// [call]
// Call is a function rather than a method so it also builds on Go versions
// before 1.27, where methods could not declare their own type parameters.
func Call[T any](b *CircuitBreaker, fn func() (T, error)) (T, error) {
	var zero T
	b.mu.Lock()
	// [openCheck]
	if b.state == Open {
		if b.clock.NowMs < b.nextAttempt {
			b.mu.Unlock()
			return zero, errors.New("circuit open, failing fast") // fn() never runs
		}
		// [halfOpenCheck]
		b.state = HalfOpen // cooldown elapsed: let exactly one trial through
		b.generation++
		// [/halfOpenCheck]
	}
	// Only one probe at a time: while it is in flight, everyone else keeps failing fast.
	if b.state == HalfOpen && b.trialInFlight {
		b.mu.Unlock()
		return zero, errors.New("circuit half-open, trial in progress")
	}
	// [/openCheck]

	isTrial := b.state == HalfOpen
	callGeneration := b.generation // only *this* call's own outcome may move that generation on
	if isTrial {
		b.trialInFlight = true
	}
	b.mu.Unlock()

	// [invoke]
	result, err := fn()
	// [/invoke]

	b.mu.Lock()
	defer b.mu.Unlock()
	if isTrial {
		b.trialInFlight = false
	}
	if err == nil {
		// [onSuccess]
		if callGeneration == b.generation {
			b.failureCount = 0
			b.state = Closed
		}
		// [/onSuccess]
		return result, nil
	}
	// [onFailure]
	if callGeneration == b.generation {
		if b.state == HalfOpen {
			b.trip() // the trial failed: straight back to Open
		} else {
			b.failureCount++
			if b.failureCount >= b.failureThreshold {
				b.trip()
			}
		}
	}
	// [/onFailure]
	return zero, err
}

// [/call]

// trip must be called with b.mu held.
func (b *CircuitBreaker) trip() {
	b.state = Open
	b.nextAttempt = b.clock.NowMs + b.cooldownMs
	b.generation++
}

// [/breaker]

// [client]
func main() {
	const cooldownMs = 4000
	clock := &Clock{}
	service := &RemoteService{Healthy: true}
	breaker := NewCircuitBreaker(clock, 3 /* failureThreshold */, cooldownMs)

	attempt := func(label string) {
		ran := "fn never ran"
		outcome, err := Call(breaker, func() (string, error) {
			ran = "fn ran while " + breaker.State().String() // only set if the breaker actually lets fn() run
			return service.Request()
		})
		if err != nil {
			outcome = err.Error()
		}
		fmt.Printf("%s: %s (%s) -> %s, service calls: %d\n", label, outcome, ran, breaker.Status(), service.Calls)
	}

	attempt("call 1") // ok (fn ran while CLOSED) -> CLOSED, failures: 0/3, service calls: 1
	service.Healthy = false
	attempt("call 2") // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 2
	attempt("call 3") // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 3
	attempt("call 4") // service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 4
	attempt("call 5") // circuit open, failing fast (fn never ran) -> OPEN, failures: 3/3, service calls: 4

	clock.Advance(cooldownMs)
	service.Healthy = true
	// Nothing has changed yet: Open only notices the elapsed cooldown on the next call.
	fmt.Printf("cooldown elapsed -> %s\n", breaker.Status()) // OPEN, failures: 3/3

	attempt("call 6") // ok (fn ran while HALF_OPEN) -> CLOSED, failures: 0/3, service calls: 5

	// Later: a fresh failure streak trips it again, and this time the trial fails too.
	service.Healthy = false
	attempt("call 7") // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 6
	attempt("call 8") // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 7
	attempt("call 9") // service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 8
	clock.Advance(cooldownMs)
	attempt("call 10") // service unavailable (fn ran while HALF_OPEN) -> OPEN, failures: 3/3, service calls: 9
}

// [/client]
