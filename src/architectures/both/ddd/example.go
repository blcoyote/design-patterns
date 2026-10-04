package main

import (
	"errors"
	"fmt"
	"math"
	"time"
)

// [money]
// Money is an immutable value object: no identity, compared by value, every op
// returns a new instance. It has no setters and its methods use value receivers,
// so none of them can change the Money they are called on.
type Money struct {
	cents    int
	currency string
}

func NewMoney(cents int, currency string) Money {
	return Money{cents: cents, currency: currency}
}

func MoneyOf(amount float64, currency string) Money {
	// math.Round rounds half away from zero, matching the other language tabs.
	return Money{cents: int(math.Round(amount * 100)), currency: currency}
}

func (m Money) Add(other Money) (Money, error) {
	if err := m.assertSameCurrency(other); err != nil {
		return Money{}, err
	}
	return Money{cents: m.cents + other.cents, currency: m.currency}, nil
}

// Equals compares by value. (Go's == on this struct would do the same; the
// method just names the value-object semantics.)
func (m Money) Equals(other Money) bool {
	return m.cents == other.cents && m.currency == other.currency
}

func (m Money) String() string {
	return fmt.Sprintf("%.2f %s", float64(m.cents)/100, m.currency)
}

func (m Money) assertSameCurrency(other Money) error {
	if other.currency != m.currency {
		return errors.New("currency mismatch")
	}
	return nil
}

// [/money]

// [orderLine]
// OrderLine is a value object: no identity of its own and never changes after
// creation — two lines with the same sku, price and quantity are interchangeable.
// Go has no read-only fields, so they are unexported (as in Money): other packages can
// only build one with NewOrderLine and never modify it. It is compared with ==.
type OrderLine struct {
	sku       string
	unitPrice Money
	quantity  int
}

func NewOrderLine(sku string, unitPrice Money, quantity int) OrderLine {
	return OrderLine{sku: sku, unitPrice: unitPrice, quantity: quantity}
}

func (l OrderLine) LineTotal() (Money, error) {
	total := MoneyOf(0, l.unitPrice.currency)
	for i := 0; i < l.quantity; i++ {
		var err error
		total, err = total.Add(l.unitPrice) // same currency by construction
		if err != nil {
			return Money{}, err
		}
	}
	return total, nil
}

// [/orderLine]

// [orderPlaced]
type DomainEvent interface {
	Name() string
	OccurredAt() time.Time
}

// OrderPlaced is a domain event: something that happened inside the Ordering bounded context.
type OrderPlaced struct {
	OrderID    string
	CustomerID string
	Total      Money
	occurredAt time.Time
}

func NewOrderPlaced(orderID, customerID string, total Money) OrderPlaced {
	return OrderPlaced{OrderID: orderID, CustomerID: customerID, Total: total, occurredAt: time.Now().UTC()}
}

func (OrderPlaced) Name() string            { return "OrderPlaced" }
func (e OrderPlaced) OccurredAt() time.Time { return e.occurredAt }

// [/orderPlaced]

// OrderPolicy is a Strategy: a domain policy injected into the aggregate
// instead of hardcoded inside it.
type OrderPolicy interface {
	IsSatisfiedBy(order *Order) bool
	Describe() string
}

type RequireAtLeastOneLine struct{}

func (RequireAtLeastOneLine) IsSatisfiedBy(order *Order) bool { return order.LineCount() > 0 }
func (RequireAtLeastOneLine) Describe() string {
	return "an order needs at least one line to be placed"
}

type OrderStatus string

const (
	StatusDraft  OrderStatus = "draft"
	StatusPlaced OrderStatus = "placed"
)

// [order]
// Order is the aggregate root: the only object outside the aggregate is
// allowed to reference directly. Its state lives in lower-case fields, and callers
// change it through its methods (all in one package here, so by convention, not by the compiler).
type Order struct {
	ID         string
	CustomerID string
	status     OrderStatus
	lines      []OrderLine
	events     []DomainEvent
}

// CreateOrder is a factory (Evans) — a plain creation function: callers never build an Order directly.
func CreateOrder(id, customerID string) *Order {
	return &Order{ID: id, CustomerID: customerID, status: StatusDraft}
}

func (o *Order) LineCount() int { return len(o.lines) }

func (o *Order) AddLine(line OrderLine) error {
	// Invariant: a placed order can never be grown again — no matter who calls this,
	// or from where. The rule lives in the aggregate, not in every caller.
	if o.status != StatusDraft {
		return fmt.Errorf("cannot add a line to order %s: already %s", o.ID, o.status)
	}
	o.lines = append(o.lines, line)
	return nil
}

func (o *Order) Total() (Money, error) {
	total := MoneyOf(0, "USD")
	for _, line := range o.lines {
		lineTotal, err := line.LineTotal()
		if err != nil {
			return Money{}, err
		}
		total, err = total.Add(lineTotal)
		if err != nil {
			return Money{}, err
		}
	}
	return total, nil
}

func (o *Order) Place(policy OrderPolicy) error {
	if o.status != StatusDraft {
		return fmt.Errorf("order %s is already %s", o.ID, o.status)
	}
	if !policy.IsSatisfiedBy(o) {
		return fmt.Errorf("cannot place order %s: %s", o.ID, policy.Describe())
	}
	total, err := o.Total()
	if err != nil {
		return err
	}
	o.status = StatusPlaced
	o.events = append(o.events, NewOrderPlaced(o.ID, o.CustomerID, total))
	return nil
}

// PullEvents returns the events raised since the last call. The aggregate itself never publishes anything.
func (o *Order) PullEvents() []DomainEvent {
	pulled := o.events
	o.events = nil
	return pulled
}

// [/order]

// [orderRepo]
// OrderRepository is a collection-like abstraction for loading and saving whole aggregates.
type OrderRepository interface {
	FindByID(orderID string) *Order // nil when absent
	Save(order *Order)
}

type InMemoryOrderRepository struct {
	orders map[string]*Order
}

func NewInMemoryOrderRepository() *InMemoryOrderRepository {
	return &InMemoryOrderRepository{orders: map[string]*Order{}}
}

func (r *InMemoryOrderRepository) FindByID(orderID string) *Order {
	return r.orders[orderID]
}

func (r *InMemoryOrderRepository) Save(order *Order) {
	r.orders[order.ID] = order
}

// [/orderRepo]

// [shipping]
// Shipping bounded context: its own vocabulary. It has never heard of an "Order".
// Money and the domain-event interface are the only types it shares with Ordering —
// a deliberately tiny shared kernel.
type ShipmentRequested struct {
	ShipmentID  string
	RecipientID string
	Value       Money
	occurredAt  time.Time
}

func NewShipmentRequested(shipmentID, recipientID string, value Money) ShipmentRequested {
	return ShipmentRequested{ShipmentID: shipmentID, RecipientID: recipientID, Value: value, occurredAt: time.Now().UTC()}
}

func (ShipmentRequested) Name() string            { return "ShipmentRequested" }
func (e ShipmentRequested) OccurredAt() time.Time { return e.occurredAt }

type ShippingService struct{}

func (ShippingService) RequestShipment(event ShipmentRequested) {
	fmt.Printf("[shipping] shipment %s requested for %s, value %s\n", event.ShipmentID, event.RecipientID, event.Value)
}

// [/shipping]

// [acl]
// OrderingToShippingAcl is an Anti-Corruption Layer, conceptually owned by the
// downstream Shipping context: it translates upstream Ordering's language into
// Shipping's own, so Ordering's model never leaks into Shipping. OrderPlaced never
// crosses the boundary as-is — only ShipmentRequested does.
type OrderingToShippingAcl struct {
	shipping *ShippingService
}

func NewOrderingToShippingAcl(shipping *ShippingService) *OrderingToShippingAcl {
	return &OrderingToShippingAcl{shipping: shipping}
}

func (a *OrderingToShippingAcl) Translate(event OrderPlaced) {
	shipmentRequested := NewShipmentRequested("ship-"+event.OrderID, event.CustomerID, event.Total)
	a.shipping.RequestShipment(shipmentRequested)
}

// [/acl]

// [appService]
// OrderApplicationService is Ordering's single entry point. No business rules of its own.
type OrderApplicationService struct {
	repository OrderRepository
	acl        *OrderingToShippingAcl
	policy     OrderPolicy
}

func NewOrderApplicationService(repository OrderRepository, acl *OrderingToShippingAcl) *OrderApplicationService {
	return &OrderApplicationService{repository: repository, acl: acl, policy: RequireAtLeastOneLine{}}
}

func (s *OrderApplicationService) StartOrder(orderID, customerID string) *Order {
	order := CreateOrder(orderID, customerID)
	s.repository.Save(order)
	return order
}

func (s *OrderApplicationService) PlaceOrder(orderID string, lines []OrderLine) (*Order, error) {
	order := s.repository.FindByID(orderID)
	if order == nil {
		return nil, fmt.Errorf("no such order: %s", orderID)
	}

	for _, line := range lines {
		if err := order.AddLine(line); err != nil {
			return nil, err
		}
	}
	if err := order.Place(s.policy); err != nil {
		return nil, err
	}
	s.repository.Save(order)

	// The application service plays observer: it collects what the aggregate raised
	// in-process, and dispatches each event onward — here, straight through the ACL.
	for _, event := range order.PullEvents() {
		if placed, ok := event.(OrderPlaced); ok {
			s.acl.Translate(placed)
		}
	}
	return order, nil
}

// [/appService]

// Usage
func main() {
	repository := NewInMemoryOrderRepository()
	acl := NewOrderingToShippingAcl(&ShippingService{})
	appService := NewOrderApplicationService(repository, acl)

	draft := appService.StartOrder("order-1", "cust-42")
	placed, err := appService.PlaceOrder(draft.ID, []OrderLine{
		NewOrderLine("WIDGET", MoneyOf(19.99, "USD"), 2),
		NewOrderLine("GADGET", MoneyOf(29.99, "USD"), 1),
	})
	if err != nil {
		panic(err)
	}
	total, err := placed.Total()
	if err != nil {
		panic(err)
	}
	fmt.Printf("order %s placed, total: %s\n", placed.ID, total)

	// Invariant in action: the aggregate refuses to grow once it has been placed.
	if err := placed.AddLine(NewOrderLine("LATE-ITEM", MoneyOf(5, "USD"), 1)); err != nil {
		fmt.Printf("rejected: %s\n", err)
	}
}
