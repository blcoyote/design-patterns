package main

import (
	"errors"
	"fmt"
)

// --- Shared pipeline infrastructure --------------------------------------
// Everything in this section is cross-cutting infrastructure: it belongs to
// no single slice, and every slice is routed through the same instance. None
// of it -- Request, Mediator, or either behaviour -- names PlaceOrderCommand or
// GetOrderQuery; a slice plugs itself in by registering a handler and, if it
// needs one, a validator for its own request type.

type Request interface {
	RequestType() string
}

// Next is the rest of the pipeline: the next behaviour, or the handler itself.
type Next func() (any, error)

type PipelineBehaviour interface {
	Handle(request Request, next Next) (any, error)
}

// [mediator]
type Mediator struct {
	handlers   map[string]func(Request) (any, error)
	behaviours []PipelineBehaviour
}

func NewMediator() *Mediator {
	return &Mediator{handlers: map[string]func(Request) (any, error){}}
}

func (m *Mediator) RegisterHandler(requestType string, handler func(Request) (any, error)) {
	m.handlers[requestType] = handler
}

// Behaviours run in registration order, outermost first: the first behaviour
// registered wraps everything after it, including every other behaviour.
func (m *Mediator) Use(behaviour PipelineBehaviour) {
	m.behaviours = append(m.behaviours, behaviour)
}

func (m *Mediator) Send(request Request) (any, error) {
	requestType := request.RequestType()
	handler, ok := m.handlers[requestType]
	if !ok {
		return nil, fmt.Errorf("no handler registered for %s", requestType)
	}

	var pipeline Next = func() (any, error) { return handler(request) }
	for i := len(m.behaviours) - 1; i >= 0; i-- {
		behaviour, next := m.behaviours[i], pipeline
		pipeline = func() (any, error) { return behaviour.Handle(request, next) }
	}
	return pipeline()
}

// [/mediator]

// [loggingBehaviour]
type LoggingBehaviour struct{}

func (b *LoggingBehaviour) Handle(request Request, next Next) (any, error) {
	fmt.Println("LOG: handling " + request.RequestType())
	result, err := next()
	// If next() fails (a behaviour further down the chain rejected the
	// request), we return here -- "LOG: handled" never prints.
	if err != nil {
		return nil, err
	}
	fmt.Println("LOG: handled " + request.RequestType())
	return result, nil
}

// [/loggingBehaviour]

// [validationBehaviour]
type ValidationBehaviour struct {
	// Validators are registered per request type by the slice that owns
	// that request -- this type holds the registry but knows no request
	// types.
	validators map[string]func(Request) error
}

func NewValidationBehaviour() *ValidationBehaviour {
	return &ValidationBehaviour{validators: map[string]func(Request) error{}}
}

func (b *ValidationBehaviour) Register(requestType string, validator func(Request) error) {
	b.validators[requestType] = validator
}

func (b *ValidationBehaviour) Handle(request Request, next Next) (any, error) {
	// A behaviour that does not call next() short-circuits the chain: no
	// behaviour after it, and no handler, ever runs for this request. Note
	// that LoggingBehaviour runs before this one, so it has already logged
	// "handling" by the time a request gets rejected here.
	if validator, ok := b.validators[request.RequestType()]; ok {
		if err := validator(request); err != nil {
			return nil, err
		}
	}
	return next()
}

// [/validationBehaviour]

// --- Shared table ---------------------------------------------------------
// Vertical slices commonly still share one physical table; what makes each
// slice "self-contained" is that it owns its own narrow data-access code on
// top of that table, not that the bytes are never shared.

type OrderRow struct {
	OrderID    string
	CustomerID string
	TotalCents int
}

// [ordersTable]
type OrdersTable struct {
	rows map[string]OrderRow
}

func NewOrdersTable() *OrdersTable {
	return &OrdersTable{rows: map[string]OrderRow{}}
}

func (t *OrdersTable) Insert(row OrderRow) {
	t.rows[row.OrderID] = row
}

func (t *OrdersTable) SelectByID(orderID string) (OrderRow, bool) {
	row, ok := t.rows[orderID]
	return row, ok
}

// [/ordersTable]

// --- PlaceOrder slice -------------------------------------------------------
// This slice's request type, handler, data access and validator, together.
// Nothing outside this slice needs to know PlaceOrderCommand exists.

// [placeOrderStore]
type PlaceOrderStore struct {
	table *OrdersTable
}

func (s *PlaceOrderStore) Save(row OrderRow) {
	s.table.Insert(row)
	fmt.Println("PlaceOrder slice: saved order " + row.OrderID)
}

// [/placeOrderStore]

// [placeOrderHandler]
type PlaceOrderCommand struct {
	OrderID    string
	CustomerID string
	TotalCents int
}

func (c PlaceOrderCommand) RequestType() string { return "PlaceOrder" }

type PlaceOrderResult struct {
	OrderID string
}

type PlaceOrderHandler struct {
	store *PlaceOrderStore
}

func (h *PlaceOrderHandler) Handle(command PlaceOrderCommand) PlaceOrderResult {
	h.store.Save(OrderRow{OrderID: command.OrderID, CustomerID: command.CustomerID, TotalCents: command.TotalCents})
	return PlaceOrderResult{OrderID: command.OrderID}
}

func ValidatePlaceOrder(command PlaceOrderCommand) error {
	if command.TotalCents <= 0 {
		return errors.New("PlaceOrder requires a positive totalCents")
	}
	return nil
}

// [/placeOrderHandler]

// --- GetOrder slice ---------------------------------------------------------
// A completely separate request type, handler, data access and validator --
// it shares no code with the PlaceOrder slice above except the Mediator, the
// pipeline and the shared OrdersTable.

// [getOrderStore]
type GetOrderStore struct {
	table *OrdersTable
}

func (s *GetOrderStore) FindByID(orderID string) (OrderRow, bool) {
	return s.table.SelectByID(orderID)
}

// [/getOrderStore]

// [getOrderHandler]
type GetOrderQuery struct {
	OrderID string
}

func (q GetOrderQuery) RequestType() string { return "GetOrder" }

type GetOrderHandler struct {
	store *GetOrderStore
}

func (h *GetOrderHandler) Handle(query GetOrderQuery) (OrderRow, error) {
	row, ok := h.store.FindByID(query.OrderID)
	if !ok {
		return OrderRow{}, fmt.Errorf("no order found for %s", query.OrderID)
	}
	return row, nil
}

func ValidateGetOrder(query GetOrderQuery) error {
	if query.OrderID == "" {
		return errors.New("GetOrder requires an orderId")
	}
	return nil
}

// [/getOrderHandler]

// --- Usage: a command through the pipeline, a query through the same one,
// and a second, invalid command to show the pipeline rejecting it ----------

// [usage]
func main() {
	table := NewOrdersTable()

	mediator := NewMediator()
	validationBehaviour := NewValidationBehaviour()
	// Each slice registers its own validator -- ValidationBehaviour never learns
	// PlaceOrderCommand or GetOrderQuery by name.
	validationBehaviour.Register("PlaceOrder", func(r Request) error { return ValidatePlaceOrder(r.(PlaceOrderCommand)) })
	validationBehaviour.Register("GetOrder", func(r Request) error { return ValidateGetOrder(r.(GetOrderQuery)) })

	mediator.Use(&LoggingBehaviour{})
	mediator.Use(validationBehaviour)

	placeOrderHandler := &PlaceOrderHandler{store: &PlaceOrderStore{table: table}}
	getOrderHandler := &GetOrderHandler{store: &GetOrderStore{table: table}}

	mediator.RegisterHandler("PlaceOrder", func(r Request) (any, error) {
		return placeOrderHandler.Handle(r.(PlaceOrderCommand)), nil
	})
	mediator.RegisterHandler("GetOrder", func(r Request) (any, error) {
		return getOrderHandler.Handle(r.(GetOrderQuery))
	})

	mediator.Send(PlaceOrderCommand{OrderID: "order-7", CustomerID: "cust-11", TotalCents: 2500})

	result, _ := mediator.Send(GetOrderQuery{OrderID: "order-7"})
	order := result.(OrderRow)
	fmt.Printf("GetOrder result: %s %s $%.2f\n", order.OrderID, order.CustomerID, float64(order.TotalCents)/100)

	// This PlaceOrder has TotalCents=0. LoggingBehaviour still logs "handling"
	// first -- it runs before ValidationBehaviour in the pipeline -- but
	// ValidationBehaviour then returns an error instead of calling next(), so
	// PlaceOrderHandler never runs (no "saved" line) and LoggingBehaviour's
	// "handled" line never prints either.
	if _, err := mediator.Send(PlaceOrderCommand{OrderID: "order-8", CustomerID: "cust-12", TotalCents: 0}); err != nil {
		fmt.Println("rejected: " + err.Error())
	}
}

// [/usage]
