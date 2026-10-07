package main

import "fmt"

// One kind of fact per event. A real system would use one type per event; a
// single shape keeps this example short.
type OrderEvent struct {
	Type       string // "OrderPlaced" or "OrderCancelled"
	OrderID    string
	CustomerID string
	Total      int
}

type LoggedEvent struct {
	Position int
	Event    OrderEvent
}

// [eventLog]
// The source of truth: an append-only log. Positions are counters, so they are
// stable and ordered.
type EventLog struct {
	entries []LoggedEvent
}

// [logAppend]
func (l *EventLog) Append(event OrderEvent) int {
	position := len(l.entries) + 1
	l.entries = append(l.entries, LoggedEvent{position, event})
	fmt.Printf("log: #%d %s %s\n", position, event.Type, event.OrderID)
	return position
}

// [/logAppend]

// [logRead]
// Builds a new slice, so callers iterate a snapshot.
func (l *EventLog) ReadAfter(position int) []LoggedEvent {
	var result []LoggedEvent
	for _, entry := range l.entries {
		if entry.Position > position {
			result = append(result, entry)
		}
	}
	return result
}

// [/logRead]
// [/eventLog]

// [readModel]
type CustomerRow struct {
	Orders int
	Spent  int
}

// A disposable read model shaped for one question: how much has each customer
// ordered? It can be deleted and rebuilt from the log at any time.
type CustomerSummaryView struct {
	rows map[string]CustomerRow
	// The position of the last event applied. It is stored with the data it
	// describes (a real store updates both in one transaction).
	Checkpoint int
}

func NewCustomerSummaryView() *CustomerSummaryView {
	return &CustomerSummaryView{rows: map[string]CustomerRow{}}
}

// [viewApply]
func (v *CustomerSummaryView) Apply(logged LoggedEvent) {
	// A position at or below the checkpoint was already applied, so a
	// redelivered event changes nothing.
	if logged.Position <= v.Checkpoint {
		fmt.Printf("view: #%d already applied, ignored\n", logged.Position)
		return
	}
	event := logged.Event
	row := v.rows[event.CustomerID]
	sign := -1
	if event.Type == "OrderPlaced" {
		sign = 1
	}
	v.rows[event.CustomerID] = CustomerRow{row.Orders + sign, row.Spent + sign*event.Total}
	v.Checkpoint = logged.Position
}

// [/viewApply]

// [viewGet]
func (v *CustomerSummaryView) Get(customerID string) (CustomerRow, bool) {
	row, ok := v.rows[customerID]
	return row, ok
}

// [/viewGet]

// [viewReset]
func (v *CustomerSummaryView) Reset() {
	v.rows = map[string]CustomerRow{}
	v.Checkpoint = 0
}

// [/viewReset]
// [/readModel]

// [projector]
// The only writer of the read model. It never decides anything: it replays what
// the log says happened.
type Projector struct {
	log  *EventLog
	view *CustomerSummaryView
}

// [catchUp]
// Pull everything after the view's own checkpoint and apply it in order.
// A real projector runs this on a schedule or when it is notified.
func (p *Projector) CatchUp() {
	pending := p.log.ReadAfter(p.view.Checkpoint)
	for _, logged := range pending {
		p.view.Apply(logged)
	}
	fmt.Printf("projector: applied %d event(s) (checkpoint %d)\n", len(pending), p.view.Checkpoint)
}

// [/catchUp]

// [rebuild]
// Throw the read model away and replay the whole log into it.
func (p *Projector) Rebuild() {
	p.view.Reset()
	fmt.Println("projector: view reset")
	p.CatchUp()
}

// [/rebuild]
// [/projector]

func main() {
	// [client]
	log := &EventLog{}
	view := NewCustomerSummaryView()
	projector := &Projector{log: log, view: view}

	show := func(customerID string) {
		if row, ok := view.Get(customerID); ok {
			fmt.Printf("%s: orders=%d spent=%d\n", customerID, row.Orders, row.Spent)
		} else {
			fmt.Printf("%s: no row yet\n", customerID)
		}
	}

	log.Append(OrderEvent{"OrderPlaced", "o1", "ada", 40})
	// log: #1 OrderPlaced o1
	log.Append(OrderEvent{"OrderPlaced", "o2", "grace", 25})
	// log: #2 OrderPlaced o2
	log.Append(OrderEvent{"OrderPlaced", "o3", "ada", 35})
	// log: #3 OrderPlaced o3
	show("ada") // the read model has not caught up yet
	// ada: no row yet

	projector.CatchUp()
	// projector: applied 3 event(s) (checkpoint 3)
	show("ada")
	// ada: orders=2 spent=75
	show("grace")
	// grace: orders=1 spent=25

	log.Append(OrderEvent{"OrderCancelled", "o1", "ada", 40})
	// log: #4 OrderCancelled o1
	projector.CatchUp()
	// projector: applied 1 event(s) (checkpoint 4)
	show("ada")
	// ada: orders=1 spent=35

	view.Apply(log.ReadAfter(3)[0]) // the same event delivered a second time
	// view: #4 already applied, ignored

	projector.Rebuild()
	// projector: view reset
	// projector: applied 4 event(s) (checkpoint 4)
	show("ada")
	// ada: orders=1 spent=35
	show("grace")
	// grace: orders=1 spent=25
	// [/client]
}
