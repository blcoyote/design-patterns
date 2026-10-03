package main

import (
	"errors"
	"sync"
	"time"
)

// [service]
// RemoteService is a downstream dependency that can start failing under load.
type RemoteService struct {
	isHealthy func() bool
}

func (s *RemoteService) Request() (string, error) {
	if !s.isHealthy() {
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

// [breaker]
// CircuitBreaker's state is guarded by a mutex because Go callers may run in
// several goroutines (TS and Python rely on a single-threaded event loop).
// The mutex is never held while fn runs, so a slow call blocks nobody.
type CircuitBreaker struct {
	mu               sync.Mutex
	failureThreshold int
	cooldownMs       int64
	state            BreakerState
	failureCount     int
	nextAttempt      int64
	trialInFlight    bool
	// Bumped on every state transition, so a slow call that started in an
	// earlier state can't drive a transition it never actually observed.
	generation int
}

func NewCircuitBreaker(failureThreshold int, cooldownMs int64) *CircuitBreaker {
	return &CircuitBreaker{failureThreshold: failureThreshold, cooldownMs: cooldownMs, state: Closed}
}

// [call]
// Call is a function rather than a method because Go methods cannot have their own type parameters.
func Call[T any](b *CircuitBreaker, fn func() (T, error)) (T, error) {
	var zero T
	b.mu.Lock()
	// [openCheck]
	if b.state == Open {
		if time.Now().UnixMilli() < b.nextAttempt {
			b.mu.Unlock()
			return zero, errors.New("circuit open — failing fast") // fn() never runs
		}
		// [halfOpenCheck]
		b.state = HalfOpen // cooldown elapsed: let exactly one trial through
		b.generation++
		// [/halfOpenCheck]
	}
	// Only one probe at a time: while it is in flight, everyone else keeps failing fast.
	if b.state == HalfOpen && b.trialInFlight {
		b.mu.Unlock()
		return zero, errors.New("circuit half-open — trial in progress")
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
		b.failureCount++
		if b.state == HalfOpen || b.failureCount >= b.failureThreshold {
			b.state = Open
			b.nextAttempt = time.Now().UnixMilli() + b.cooldownMs
			b.generation++
		}
	}
	// [/onFailure]
	return zero, err
}

// [/call]

// [/breaker]

// [client]
func main() {
	serviceIsHealthy := true
	service := &RemoteService{isHealthy: func() bool { return serviceIsHealthy }}
	breaker := NewCircuitBreaker(3 /* failureThreshold */, 4000 /* cooldownMs */)

	_, _ = Call(breaker, service.Request)
}

// [/client]
