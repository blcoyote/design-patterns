package main

import (
	"errors"
	"fmt"
	"strconv"
)

type LineItem struct {
	Sku   string
	Price float64
}

type PlaceOrderCommand struct {
	CustomerID string
	Items      []LineItem
}

// [port]
// Driving port: the only way into the core. Adapters depend on this
// interface; the core never depends on them.
type PlaceOrderUseCase interface {
	Execute(command PlaceOrderCommand) (*Order, error)
}

// [/port]

// [order]
// Domain entity, part of the core. It knows nothing about HTTP, SQL or any
// adapter -- only its own rules.
type Order struct {
	CustomerID string
	Lines      []LineItem
}

func NewOrder(customerID string) *Order {
	return &Order{CustomerID: customerID}
}

func (o *Order) AddLine(item LineItem) error {
	if item.Price <= 0 {
		return errors.New("line item must have a positive price")
	}
	o.Lines = append(o.Lines, item)
	return nil
}

func (o *Order) Total() float64 {
	total := 0.0
	for _, line := range o.Lines {
		total += line.Price
	}
	return total
}

// [/order]

// [repoPort]
// Driven port: the core declares the capability it needs, in its own
// vocabulary. It has no idea Postgres or an in-memory list will answer it.
type OrderRepository interface {
	Save(order *Order)
}

// [/repoPort]

// [service]
// The core's application service. It implements the driving port and
// depends only on the driven port's interface -- never a concrete adapter.
type PlaceOrderService struct {
	orders OrderRepository
}

func NewPlaceOrderService(orders OrderRepository) *PlaceOrderService {
	return &PlaceOrderService{orders: orders}
}

func (s *PlaceOrderService) Execute(command PlaceOrderCommand) (*Order, error) {
	order := NewOrder(command.CustomerID)
	for _, item := range command.Items {
		if err := order.AddLine(item); err != nil {
			return nil, err
		}
	}
	s.orders.Save(order)
	return order, nil
}

// [/service]

// [postgres]
// Driven adapter #1: talks to a real database. Swappable because it is
// just another OrderRepository as far as the core is concerned.
type PostgresOrderRepository struct{}

func (r *PostgresOrderRepository) Save(order *Order) {
	databaseQuery(fmt.Sprintf("INSERT INTO orders (customer_id, total) VALUES ('%s', %s)",
		order.CustomerID, strconv.FormatFloat(order.Total(), 'f', -1, 64)))
}

// [/postgres]

// [inMemory]
// Driven adapter #2: an in-memory stand-in used by tests. Same port, zero
// infrastructure, and the core cannot tell the difference.
type InMemoryOrderRepository struct {
	Saved []*Order
}

func (r *InMemoryOrderRepository) Save(order *Order) {
	r.Saved = append(r.Saved, order)
}

// A true Null Object: same port, but it discards every write instead of
// keeping one. A safe, crash-free default for local development before a
// real adapter is wired in -- unlike InMemoryOrderRepository, nothing can be
// read back out of it.
type NullOrderRepository struct{}

func (r *NullOrderRepository) Save(order *Order) {
	// intentionally does nothing
}

// [/inMemory]

// [controller]
// Driving adapter: translates an inbound HTTP request into the command the
// driving port understands, and calls it. It depends on the port, never on
// PlaceOrderService directly.
type HttpOrderController struct {
	useCase PlaceOrderUseCase
}

func NewHttpOrderController(useCase PlaceOrderUseCase) *HttpOrderController {
	return &HttpOrderController{useCase: useCase}
}

func (c *HttpOrderController) HandlePost(customerID string, items []LineItem) (int, string, error) {
	order, err := c.useCase.Execute(PlaceOrderCommand{CustomerID: customerID, Items: items})
	if err != nil {
		return 0, "", err
	}
	return 201, order.CustomerID, nil
}

// [/controller]

func databaseQuery(sql string) {
	fmt.Println("SQL: " + sql)
}

// [test]
// Test harness: the SAME PlaceOrderService, the SAME PlaceOrderUseCase port --
// only the driven adapter changes. The core is never touched, recompiled or
// mocked; it just receives a different implementation of OrderRepository.
func testPlaceOrderWritesToRepository() {
	repo := &InMemoryOrderRepository{}
	var useCase PlaceOrderUseCase = NewPlaceOrderService(repo)

	useCase.Execute(PlaceOrderCommand{CustomerID: "cust-1", Items: []LineItem{{"WIDGET", 9.99}}})

	if len(repo.Saved) != 1 {
		panic("expected exactly one saved order")
	}
	fmt.Println("test passed: order persisted through the in-memory adapter")
}

// [/test]

func main() {
	// Usage: production wiring plugs the real database adapter into the core.
	controller := NewHttpOrderController(NewPlaceOrderService(&PostgresOrderRepository{}))
	controller.HandlePost("cust-42", []LineItem{{"WIDGET", 19.99}, {"GADGET", 29.99}})

	testPlaceOrderWritesToRepository()
}
