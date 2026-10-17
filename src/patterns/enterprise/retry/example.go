package main

import (
	"errors"
	"fmt"
)

// [sleeper]
// FakeSleeper only adds up the time, nothing really waits.
type FakeSleeper struct{ TotalMs int }

func (s *FakeSleeper) Sleep(ms int) { s.TotalMs += ms }

// [/sleeper]

// [jitter]
// ScriptedJitter hands out percentages 0-100 in order and never resets, so the output is
// the same on every run. A real client draws them at random (full jitter is a uniform
// pick between 0 and the ceiling).
type ScriptedJitter struct {
	percents []int
	next     int
}

func (j *ScriptedJitter) NextPercent() int {
	percent := j.percents[j.next%len(j.percents)]
	j.next++
	return percent
}

// [/jitter]

// [service]
type ApiError struct{ Status int }

func (e *ApiError) Error() string { return fmt.Sprintf("HTTP %d", e.Status) }

// FlakyService is GET /inventory (idempotent). The script lists the status of each call;
// the last one repeats.
type FlakyService struct {
	script []int
	calls  int
}

func (s *FlakyService) Get() (string, error) {
	i := s.calls
	if i > len(s.script)-1 {
		i = len(s.script) - 1
	}
	s.calls++
	if status := s.script[i]; status >= 400 {
		return "", &ApiError{Status: status}
	}
	return "inventory: 12 items", nil
}

// [/service]

// [policy]
type RetryPolicy struct {
	MaxAttempts int
	BaseMs      int
	CapMs       int
}

// CeilingMs is exponential backoff: base, 2 x base, 4 x base ..., never above the cap.
func (p RetryPolicy) CeilingMs(attempt int) int {
	return min(p.CapMs, p.BaseMs*(1<<(attempt-1)))
}

// [/policy]

type Outcome struct {
	Ok       bool
	Attempts int
	WaitedMs int
	Status   int
}

// [retrier]
type Retrier struct {
	policy  RetryPolicy
	jitter  *ScriptedJitter
	sleeper *FakeSleeper
}

func (r *Retrier) Execute(fn func() (string, error)) Outcome {
	slept := r.sleeper.TotalMs
	outcome := func(ok bool, attempts, status int) Outcome {
		return Outcome{ok, attempts, r.sleeper.TotalMs - slept, status}
	}

	for attempt := 1; ; attempt++ {
		// [attempt]
		_, err := fn()
		if err == nil {
			fmt.Printf("attempt %d: ok\n", attempt)
			return outcome(true, attempt, 200)
		}
		var apiErr *ApiError
		if !errors.As(err, &apiErr) {
			panic(err)
		}
		// [classify]
		if apiErr.Status < 500 {
			fmt.Printf("attempt %d: %d -> not retryable\n", attempt, apiErr.Status)
			return outcome(false, attempt, apiErr.Status)
		}
		// [/classify]
		// [giveUp]
		if attempt == r.policy.MaxAttempts {
			fmt.Printf("attempt %d: %d -> giving up\n", attempt, apiErr.Status)
			return outcome(false, attempt, apiErr.Status)
		}
		// [/giveUp]
		// [wait]
		ceiling := r.policy.CeilingMs(attempt)
		delay := ceiling * r.jitter.NextPercent() / 100
		fmt.Printf("attempt %d: %d -> retry in %dms (ceiling %dms)\n", attempt, apiErr.Status, delay, ceiling)
		r.sleeper.Sleep(delay)
		// [/wait]
		// [/attempt]
	}
}

// [/retrier]

// [client]
func describe(o Outcome) string {
	tail := fmt.Sprintf("attempts %d, waited %dms", o.Attempts, o.WaitedMs)
	switch {
	case o.Ok:
		return "ok, " + tail
	case o.Status >= 500:
		return fmt.Sprintf("gave up (%d), %s", o.Status, tail)
	default:
		return fmt.Sprintf("failed (%d, not retryable), %s", o.Status, tail)
	}
}

func main() {
	retrier := &Retrier{
		policy:  RetryPolicy{MaxAttempts: 4, BaseMs: 100, CapMs: 400},
		jitter:  &ScriptedJitter{percents: []int{50, 25, 75, 40, 90, 10}},
		sleeper: &FakeSleeper{},
	}

	call := func(title string, script []int) {
		fmt.Printf("--- %s ---\n", title)
		service := &FlakyService{script: script}
		fmt.Printf("result: %s\n", describe(retrier.Execute(service.Get)))
	}

	call("call 1: succeeds on attempt 4", []int{503, 503, 503, 200})
	call("call 2: always fails", []int{503})
	call("call 3: bad request", []int{400})
}

// [/client]
