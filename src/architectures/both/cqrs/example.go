package main

import (
	"fmt"
	"strconv"
)

// --- Write side -------------------------------------------------------

// Command is the marker every command implements; the dispatcher routes on Type().
type Command interface {
	Type() string
}

type PlaceOrderCommand struct {
	OrderID    string
	CustomerID string
	TotalCents int
}

func (PlaceOrderCommand) Type() string { return "PlaceOrder" }

// [aggregate]
type Order struct {
	ID         string
	CustomerID string
	TotalCents int
	Status     string
}

func NewOrder(id, customerID string, totalCents int) *Order {
	return &Order{ID: id, CustomerID: customerID, TotalCents: totalCents, Status: "placed"}
}

// [/aggregate]

type WriteStore interface {
	Save(order *Order)
}

// [writeStore]
type SqlWriteStore struct {
	rows map[string]*Order
}

func NewSqlWriteStore() *SqlWriteStore {
	return &SqlWriteStore{rows: map[string]*Order{}}
}

func (s *SqlWriteStore) Save(order *Order) {
	s.rows[order.ID] = order
	fmt.Printf("WRITE DB: upserted order %s\n", order.ID)
}

// [/writeStore]

// [dispatcher]
type CommandDispatcher struct {
	handlers map[string]func(Command)
}

func NewCommandDispatcher() *CommandDispatcher {
	return &CommandDispatcher{handlers: map[string]func(Command){}}
}

func (d *CommandDispatcher) Register(commandType string, handler func(Command)) {
	d.handlers[commandType] = handler
}

func (d *CommandDispatcher) Dispatch(command Command) {
	handler, ok := d.handlers[command.Type()]
	if !ok {
		panic(fmt.Sprintf("no handler registered for %s", command.Type()))
	}
	handler(command)
}

// [/dispatcher]

// [commandHandler]
type PlaceOrderHandler struct {
	writeStore WriteStore
	projector  *Projector
}

func NewPlaceOrderHandler(writeStore WriteStore, projector *Projector) *PlaceOrderHandler {
	return &PlaceOrderHandler{writeStore: writeStore, projector: projector}
}

func (h *PlaceOrderHandler) Handle(command PlaceOrderCommand) {
	order := NewOrder(command.OrderID, command.CustomerID, command.TotalCents)
	h.writeStore.Save(order)
	// In a real system the projector would pick this up off a queue, a CDC
	// stream or a cron job — asynchronously, on its own schedule. Here that
	// queue is modeled explicitly: enqueuing is instant, but nothing is
	// projected into the read store until something calls projector.CatchUp().
	h.projector.Enqueue(order)
}

// [/commandHandler]

// --- Read side ----------------------------------------------------------

type OrderSummaryView struct {
	OrderID      string
	CustomerID   string
	TotalDisplay string
	Status       string
}

type ReadStore interface {
	Upsert(view *OrderSummaryView)
	Find(orderID string) *OrderSummaryView
}

// [readStore]
type InMemoryReadStore struct {
	views map[string]*OrderSummaryView
}

func NewInMemoryReadStore() *InMemoryReadStore {
	return &InMemoryReadStore{views: map[string]*OrderSummaryView{}}
}

func (s *InMemoryReadStore) Upsert(view *OrderSummaryView) {
	s.views[view.OrderID] = view
}

// Find returns nil when there is no view for the id.
func (s *InMemoryReadStore) Find(orderID string) *OrderSummaryView {
	return s.views[orderID]
}

// [/readStore]

// [projector]
type Projector struct {
	readStore ReadStore
	queue     []*Order
}

func NewProjector(readStore ReadStore) *Projector {
	return &Projector{readStore: readStore}
}

// Enqueue schedules a projection. Stands in for a message landing on a real queue.
func (p *Projector) Enqueue(order *Order) {
	p.queue = append(p.queue, order)
}

// CatchUp drains the queue, turning each pending write-model change into the
// denormalised read shape. Calling this is the deterministic stand-in for
// "enough time has passed for the projector to have run".
func (p *Projector) CatchUp() {
	for _, order := range p.queue {
		view := &OrderSummaryView{
			OrderID:      order.ID,
			CustomerID:   order.CustomerID,
			TotalDisplay: "$" + strconv.FormatFloat(float64(order.TotalCents)/100, 'f', 2, 64),
			Status:       order.Status,
		}
		p.readStore.Upsert(view)
		fmt.Printf("READ DB: projected order %s\n", view.OrderID)
	}
	p.queue = nil
}

// [/projector]

// [queryHandler]
type GetOrderSummaryHandler struct {
	readStore ReadStore
}

func NewGetOrderSummaryHandler(readStore ReadStore) *GetOrderSummaryHandler {
	return &GetOrderSummaryHandler{readStore: readStore}
}

func (h *GetOrderSummaryHandler) Handle(orderID string) *OrderSummaryView {
	return h.readStore.Find(orderID)
}

// [/queryHandler]

func formatView(view *OrderSummaryView) string {
	if view == nil {
		return "(none yet)"
	}
	return fmt.Sprintf("%s %s %s %s", view.OrderID, view.CustomerID, view.TotalDisplay, view.Status)
}

// --- Usage: command then an immediate query, to surface the lag ---------

// [usage]
func main() {
	writeStore := NewSqlWriteStore()
	readStore := NewInMemoryReadStore()
	projector := NewProjector(readStore)
	placeOrderHandler := NewPlaceOrderHandler(writeStore, projector)
	getOrderSummary := NewGetOrderSummaryHandler(readStore)

	dispatcher := NewCommandDispatcher()
	dispatcher.Register("PlaceOrder", func(command Command) { placeOrderHandler.Handle(command.(PlaceOrderCommand)) })

	dispatcher.Dispatch(PlaceOrderCommand{OrderID: "order-9", CustomerID: "cust-42", TotalCents: 4998})

	// [eventualConsistency]
	// Querying immediately after the command returns misses the projection: the
	// write succeeded, but nothing has drained the projector's queue yet.
	fmt.Println("query right after dispatch:", formatView(getOrderSummary.Handle("order-9")))

	projector.CatchUp()

	fmt.Println("query after the projector has run:", formatView(getOrderSummary.Handle("order-9")))
	// [/eventualConsistency]
}

// [/usage]
