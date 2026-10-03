package main

import (
	"fmt"
	"strconv"
)

// In production Go you might reach for channels or plain callback funcs
// instead of hand-rolling this, but we keep the explicit pattern structure
// here for clarity.

// formatPrice prints 99 as "99" and 101.5 as "101.5", like JS and Python.
func formatPrice(p float64) string {
	return strconv.FormatFloat(p, 'f', -1, 64)
}

// [observer]
type Observer interface {
	Update(price float64)
}

// [/observer]

// [subject]
type StockTicker struct {
	observers []Observer
	price     float64
}

// [subscribe]
func (t *StockTicker) Subscribe(o Observer) {
	t.observers = append(t.observers, o)
}

// [/subscribe]

// [unsubscribe]
func (t *StockTicker) Unsubscribe(o Observer) {
	// Build a new slice so a round of notify() already ranging over the old one is unaffected.
	kept := make([]Observer, 0, len(t.observers))
	for _, x := range t.observers {
		if x != o {
			kept = append(kept, x)
		}
	}
	t.observers = kept
}

// [/unsubscribe]

// [setPrice]
func (t *StockTicker) SetPrice(price float64) {
	t.price = price
	t.notify()
}

// [/setPrice]

// [notify]
func (t *StockTicker) notify() {
	// Loop over a snapshot so an observer that subscribes or unsubscribes
	// mid-notify doesn't affect the round we're already delivering.
	for _, o := range append([]Observer(nil), t.observers...) {
		o.Update(t.price)
	}
}

// [/notify]
// [/subject]

// [concrete]
// [chart]
type PriceChart struct{}

func (c *PriceChart) Update(price float64) {
	fmt.Println("chart: plot " + formatPrice(price))
}

// [/chart]

// [alert]
type PriceAlert struct {
	limit float64
}

func (a *PriceAlert) Update(price float64) {
	if price > a.limit {
		fmt.Println("warning: price above " + formatPrice(a.limit) + "!")
	}
}

// [/alert]

// [logger]
type AuditLog struct {
	entries []float64
}

func (l *AuditLog) Update(price float64) {
	l.entries = append(l.entries, price)
}

// [/logger]
// [/concrete]

func main() {
	ticker := &StockTicker{}
	alert := &PriceAlert{limit: 100}
	ticker.Subscribe(&PriceChart{})
	ticker.Subscribe(alert)
	ticker.Subscribe(&AuditLog{})

	ticker.SetPrice(101.5) // all three react
	ticker.Unsubscribe(alert)
	ticker.SetPrice(99) // only chart + log
}
