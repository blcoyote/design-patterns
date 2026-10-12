package main

import (
	"fmt"
	"math"
	"slices"
)

// [result]
// Errors are values. Go has no Result type: a step that can fail returns a
// (value, error) pair, so the possibility of failure is visible in the signature and the
// caller has to deal with it. DomainError is the error value for a business-rule failure.
type DomainError struct {
	Message string
}

func (e DomainError) Error() string { return e.Message }

// Railway-oriented programming is the early return: after each step, `if err != nil`
// returns the same error and skips every later step, so the first error short-circuits.
// Go has no generic bind helper that reads better than that, so there is none here.

// [/result]

// [money]
// Value object as plain data: no methods that change it, no hidden state. Equal fields
// mean equal money (== works on the struct).
type Money struct {
	Cents    int64
	Currency string
}

// NewMoney rounds half away from zero, the same way as the OO version's Money.of.
func NewMoney(amount float64, currency string) Money {
	scaled := amount * 100
	cents := int64(math.Copysign(math.Floor(math.Abs(scaled)+0.5), scaled))
	return Money{Cents: cents, Currency: currency}
}

// USD is NewMoney with the default currency (Go has no default arguments).
func USD(amount float64) Money {
	return NewMoney(amount, "USD")
}

func AddMoney(a, b Money) Money {
	// Adding two currencies is a programmer bug, not a domain outcome: no business
	// process "fails" this way, so it panics (Wlaschin: errors you model vs. panics).
	if a.Currency != b.Currency {
		panic("currency mismatch")
	}
	return Money{Cents: a.Cents + b.Cents, Currency: a.Currency}
}

func FormatMoney(m Money) string {
	return fmt.Sprintf("%.2f %s", float64(m.Cents)/100, m.Currency)
}

// [/money]

// [orderLine]
// Value object as plain data, created only through CreateOrderLine by convention
// (the fields are exported, so Go cannot forbid a struct literal elsewhere).
type OrderLine struct {
	Sku       string
	UnitPrice Money
	Quantity  int
}

// CreateOrderLine is the smart constructor: the one place an OrderLine is meant to be
// built. As long as code goes through it, an invalid line never reaches the rest of the
// model. The failure comes back as an error value, not a panic.
func CreateOrderLine(sku string, unitPrice Money, quantity int) (OrderLine, error) {
	if quantity < 1 {
		return OrderLine{}, DomainError{fmt.Sprintf("invalid line %s: quantity must be at least 1", sku)}
	}
	return OrderLine{Sku: sku, UnitPrice: unitPrice, Quantity: quantity}, nil
}

func LineTotal(line OrderLine) Money {
	total := NewMoney(0, line.UnitPrice.Currency)
	for i := 0; i < line.Quantity; i++ {
		total = AddMoney(total, line.UnitPrice)
	}
	return total
}

// [/orderLine]

// [order]
// Type-state: an order is either a draft or placed, and the two are different types.
// Only a PlacedOrder has a total, so "total of a draft" cannot even be written.
// Go has no sum types, so Order is a sealed interface: the unexported isOrder method
// means only this package can implement it, and a type switch matches the two cases.
// Structs are passed by value, so a transition builds a new value and leaves the old
// one alone (the Lines slice is cloned before it grows, see AddLine).
type Order interface{ isOrder() }

type DraftOrder struct {
	ID         string
	CustomerID string
	Lines      []OrderLine
}

type PlacedOrder struct {
	ID         string
	CustomerID string
	Lines      []OrderLine
	Total      Money
}

func (DraftOrder) isOrder()  {}
func (PlacedOrder) isOrder() {}

// CreateDraft is the factory function: an order always starts as an empty draft.
func CreateDraft(id, customerID string) DraftOrder {
	return DraftOrder{ID: id, CustomerID: customerID, Lines: []OrderLine{}}
}

// orderID reads the id common to both cases with a type switch.
func orderID(order Order) string {
	switch o := order.(type) {
	case DraftOrder:
		return o.ID
	case PlacedOrder:
		return o.ID
	default:
		panic("unknown order type")
	}
}

// [/order]

// [orderPlaced]
// Domain event as plain data. It carries no timestamp: the imperative shell would
// stamp the time, which keeps the core pure (no clock reads). OrderEvent is a sealed
// interface in the same way as Order, with OrderPlaced as its only case.
type OrderEvent interface{ isOrderEvent() }

type OrderPlaced struct {
	OrderID    string
	CustomerID string
	Total      Money
}

func (OrderPlaced) isOrderEvent() {}

// [/orderPlaced]

// [rules]
// Business rules as pure functions: each takes values and returns new values. None of
// them mutates its input or performs I/O.

// Strategy as a function type: a policy is just a function from a draft to a result.
type OrderPolicy func(order DraftOrder) (DraftOrder, error)

func RequireAtLeastOneLine(order DraftOrder) (DraftOrder, error) {
	if len(order.Lines) > 0 {
		return order, nil
	}
	return DraftOrder{}, DomainError{fmt.Sprintf("cannot place order %s: an order needs at least one line to be placed", order.ID)}
}

type PlaceOrderOutcome struct {
	Order  PlacedOrder
	Events []OrderEvent
}

// AddLine matches on the order's type. Go does not check that a type switch is
// exhaustive, so the default case panics for a type that is not part of the sealed set.
func AddLine(order Order, line OrderLine) (DraftOrder, error) {
	switch o := order.(type) {
	case DraftOrder:
		// A new draft: the old lines are cloned before the append, so the old draft's
		// backing array is never written to.
		return DraftOrder{
			ID:         o.ID,
			CustomerID: o.CustomerID,
			Lines:      append(slices.Clone(o.Lines), line),
		}, nil
	case PlacedOrder:
		// The invariant: a placed order cannot grow. It comes back as an error value.
		return DraftOrder{}, DomainError{fmt.Sprintf("cannot add a line to order %s: already placed", o.ID)}
	default:
		panic("unknown order type")
	}
}

func Place(order Order, policy OrderPolicy) (PlaceOrderOutcome, error) {
	switch o := order.(type) {
	case PlacedOrder:
		return PlaceOrderOutcome{}, DomainError{fmt.Sprintf("order %s is already placed", o.ID)}
	case DraftOrder:
		accepted, err := policy(o)
		if err != nil {
			return PlaceOrderOutcome{}, err
		}
		// Fold the line totals into one Money.
		total := NewMoney(0, "USD")
		for _, line := range accepted.Lines {
			total = AddMoney(total, LineTotal(line))
		}
		placed := PlacedOrder{
			ID:         accepted.ID,
			CustomerID: accepted.CustomerID,
			Lines:      accepted.Lines,
			Total:      total,
		}
		// The event is returned alongside the new order. Nothing is stored or published here.
		placedEvent := OrderPlaced{
			OrderID:    placed.ID,
			CustomerID: placed.CustomerID,
			Total:      placed.Total,
		}
		return PlaceOrderOutcome{Order: placed, Events: []OrderEvent{placedEvent}}, nil
	default:
		panic("unknown order type")
	}
}

// [/rules]

// [workflow]
// The input as it arrives from outside: raw, unvalidated numbers and strings.
type UnvalidatedLine struct {
	Sku      string
	Price    float64
	Quantity int
}

type PlaceOrderCommand struct {
	OrderID string
	Lines   []UnvalidatedLine
}

// PlaceOrderWorkflow is the use case as one pure function: (order, command, policy) in,
// (outcome, error) out. It validates each raw line (CreateOrderLine), adds it (AddLine),
// then places the order. Each step returns early on an error, so the first error skips
// every later step. No I/O: loading the order and storing the result are the handler's job.
func PlaceOrderWorkflow(order Order, cmd PlaceOrderCommand, policy OrderPolicy) (PlaceOrderOutcome, error) {
	current := order
	for _, raw := range cmd.Lines {
		line, err := CreateOrderLine(raw.Sku, USD(raw.Price), raw.Quantity)
		if err != nil {
			return PlaceOrderOutcome{}, err
		}
		draft, err := AddLine(current, line)
		if err != nil {
			return PlaceOrderOutcome{}, err
		}
		current = draft
	}
	return Place(current, policy)
}

// [/workflow]

// [orderStore]
// Repository as a struct of functions instead of an interface with a type behind it.
type LoadOrder func(id string) (Order, bool)
type SaveOrder func(order Order)

type OrderStore struct {
	Load LoadOrder
	Save SaveOrder
}

// InMemoryOrderStore is the in-memory adapter: the two functions close over a map.
// Saving replaces whatever was stored under that id.
func InMemoryOrderStore() OrderStore {
	orders := map[string]Order{}
	return OrderStore{
		Load: func(id string) (Order, bool) {
			order, found := orders[id]
			return order, found
		},
		Save: func(order Order) {
			orders[orderID(order)] = order
		},
	}
}

// [/orderStore]

// [shipping]
// Shipping bounded context: its own vocabulary. It has never heard of an "Order" or
// of OrderPlaced.
type ShipmentRequested struct {
	ShipmentID  string
	RecipientID string
	Value       Money
}

// RequestShipment is a side effect, so it lives in the shell, not in the pure core.
func RequestShipment(event ShipmentRequested) {
	fmt.Printf("[shipping] shipment %s requested for %s, value %s\n", event.ShipmentID, event.RecipientID, FormatMoney(event.Value))
}

// [/shipping]

// [acl]
// Anti-Corruption Layer as a pure function: translates Ordering's OrderPlaced into
// Shipping's own ShipmentRequested, so Ordering's model never leaks into Shipping.
// It only builds a new value; delivering it is the handler's job.
func ToShipmentRequested(event OrderPlaced) ShipmentRequested {
	return ShipmentRequested{
		ShipmentID:  "ship-" + event.OrderID,
		RecipientID: event.CustomerID,
		Value:       event.Total,
	}
}

// [/acl]

// [handler]
// Dependencies are plain functions. They are handed over once, when the handler is built.
type PlaceOrderDeps struct {
	Load    LoadOrder
	Save    SaveOrder
	Publish func(event ShipmentRequested)
	Policy  OrderPolicy
}

// MakePlaceOrderHandler builds the imperative shell: I/O at the edges, the pure workflow
// in the middle. The dependencies reach it through a closure (partial application), not
// a constructor. Order: load (I/O), run the pure workflow, on success save (I/O), then
// publish each event.
func MakePlaceOrderHandler(deps PlaceOrderDeps) func(PlaceOrderCommand) (PlacedOrder, error) {
	return func(cmd PlaceOrderCommand) (PlacedOrder, error) {
		existing, found := deps.Load(cmd.OrderID)
		if !found {
			return PlacedOrder{}, DomainError{fmt.Sprintf("no such order: %s", cmd.OrderID)}
		}

		outcome, err := PlaceOrderWorkflow(existing, cmd, deps.Policy)
		if err != nil {
			return PlacedOrder{}, err
		}

		deps.Save(outcome.Order)
		for _, event := range outcome.Events {
			switch e := event.(type) {
			case OrderPlaced:
				deps.Publish(ToShipmentRequested(e))
			}
		}
		return outcome.Order, nil
	}
}

// [/handler]

// Usage
func main() {
	store := InMemoryOrderStore()
	handlePlaceOrder := MakePlaceOrderHandler(PlaceOrderDeps{
		Load:    store.Load,
		Save:    store.Save,
		Publish: RequestShipment,
		Policy:  RequireAtLeastOneLine,
	})

	draft := CreateDraft("order-1", "cust-42")
	store.Save(draft)

	placed, err := handlePlaceOrder(PlaceOrderCommand{
		OrderID: "order-1",
		Lines: []UnvalidatedLine{
			{Sku: "WIDGET", Price: 19.99, Quantity: 2},
			{Sku: "GADGET", Price: 29.99, Quantity: 1},
		},
	})
	if err != nil {
		fmt.Println("rejected:", err)
	} else {
		fmt.Printf("order %s placed, total: %s\n", placed.ID, FormatMoney(placed.Total))
	}

	// Nothing was mutated: the local draft is still the empty draft it was. The kind is
	// read with a type switch, as the TS version reads its "kind" field.
	var original Order = draft
	kind := "placed"
	if _, isDraft := original.(DraftOrder); isDraft {
		kind = "draft"
	}
	fmt.Printf("original draft untouched: %s, %d lines\n", kind, len(draft.Lines))

	// The invariant in action: a placed order refuses to grow, and says so with an error value.
	stored, found := store.Load("order-1")
	if !found {
		panic("order-1 should be in the store")
	}
	lateLine, err := CreateOrderLine("LATE-ITEM", USD(5), 1)
	if err == nil {
		_, err = AddLine(stored, lateLine)
	}
	if err != nil {
		fmt.Println("rejected:", err)
	}

	// A smart constructor refuses an invalid line, also as a value.
	_, err = CreateOrderLine("BROKEN", USD(1), 0)
	if err != nil {
		fmt.Println("rejected:", err)
	}
}
