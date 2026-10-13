package main

import "fmt"

// [bulkhead]
// Bulkhead is a fixed number of concurrent-call slots, used by one dependency or shared by several.
type Bulkhead struct {
	Name          string
	MaxConcurrent int
	InFlight      int
	Rejected      int
}

func NewBulkhead(name string, maxConcurrent int) *Bulkhead {
	return &Bulkhead{Name: name, MaxConcurrent: maxConcurrent}
}

// There is no waiting queue: a full bulkhead rejects at once. Real ones often
// allow a short wait or a bounded queue before rejecting.
func (b *Bulkhead) TryAcquire() bool {
	if b.InFlight >= b.MaxConcurrent {
		b.Rejected++ // a rejected call never takes a slot
		return false
	}
	b.InFlight++
	return true
}

func (b *Bulkhead) Release() {
	if b.InFlight == 0 {
		panic(fmt.Sprintf("%s: release without a matching acquire", b.Name))
	}
	b.InFlight--
}

// [/bulkhead]

// [dependency]
// Concurrency is simulated: a started call stays in flight until the calling code
// finishes it, which stands in for a slow response. There are no goroutines or
// timers. Real calls finish on their own on many threads, so a real limiter must be
// thread-safe (atomic counters or a semaphore).
type Dependency struct {
	Name        string
	bulkhead    *Bulkhead
	inFlightIDs []string
}

func NewDependency(name string, bulkhead *Bulkhead) *Dependency {
	return &Dependency{Name: name, bulkhead: bulkhead}
}

func (d *Dependency) Start(callID string) bool {
	if !d.bulkhead.TryAcquire() {
		fmt.Printf("[%s] %s rejected: %s is full (%d/%d)\n", d.Name, callID, d.bulkhead.Name, d.bulkhead.InFlight, d.bulkhead.MaxConcurrent)
		return false
	}
	d.inFlightIDs = append(d.inFlightIDs, callID)
	fmt.Printf("[%s] %s started (%s %d/%d)\n", d.Name, callID, d.bulkhead.Name, d.bulkhead.InFlight, d.bulkhead.MaxConcurrent)
	return true
}

func (d *Dependency) Finish(callID string) {
	index := -1
	for i, id := range d.inFlightIDs {
		if id == callID {
			index = i
			break
		}
	}
	if index == -1 {
		panic(fmt.Sprintf("%s: %s is not in flight", d.Name, callID))
	}
	d.inFlightIDs = append(d.inFlightIDs[:index], d.inFlightIDs[index+1:]...) // removes the first match only
	d.bulkhead.Release()
	fmt.Printf("[%s] %s finished (%s %d/%d)\n", d.Name, callID, d.bulkhead.Name, d.bulkhead.InFlight, d.bulkhead.MaxConcurrent)
}

// [/dependency]

// [shared]
func runShared() *Bulkhead {
	fmt.Println("--- shared pool (no bulkhead), limit 4 ---")
	shared := NewBulkhead("shared", 4)
	payments := NewDependency("payments", shared)
	recommendations := NewDependency("recommendations", shared)

	// Recommendations is slow: its calls stay in flight.
	recommendations.Start("r1")
	recommendations.Start("r2")
	recommendations.Start("r3")
	recommendations.Start("r4")

	// One slow dependency used up the slots that payments needed.
	payments.Start("p1") // rejected
	return shared
}

// [/shared]

// [isolated]
func runIsolated() (*Bulkhead, *Bulkhead) {
	fmt.Println("--- one bulkhead per dependency, 2 slots each ---")
	paymentsBulkhead := NewBulkhead("payments", 2)
	recsBulkhead := NewBulkhead("recommendations", 2)
	payments := NewDependency("payments", paymentsBulkhead)
	recommendations := NewDependency("recommendations", recsBulkhead)

	recommendations.Start("r1")
	recommendations.Start("r2")
	recommendations.Start("r3") // rejected: only recommendations is full

	payments.Start("p1") // unaffected by the slow dependency
	payments.Finish("p1")

	recommendations.Finish("r1") // frees a slot...
	recommendations.Start("r4")  // ...which the next call reuses
	return paymentsBulkhead, recsBulkhead
}

// [/isolated]

// [usage]
func main() {
	shared := runShared()
	paymentsBulkhead, recsBulkhead := runIsolated()
	fmt.Printf("rejected: shared %d, payments %d, recommendations %d\n", shared.Rejected, paymentsBulkhead.Rejected, recsBulkhead.Rejected)
}

// [/usage]
