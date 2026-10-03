package main

import (
	"errors"
	"fmt"
)

type OrderLine struct {
	Sku      string
	Quantity int
}

// Product is Orders' own model of a product -- only what Orders needs, in Orders' own vocabulary.
type Product struct {
	Sku   string
	Name  string
	Price float64
}

type OrderPlacedEvent struct {
	OrderID string
	Lines   []OrderLine
	Total   float64
}

type OrderRecord struct {
	OrderID string
	Total   float64
	Status  string
}

type PlaceOrderResult struct {
	OrderID string
	Total   float64
	Status  string
	Reason  string // empty string when the order was paid
}

// [inventory]
// ProductDto is Inventory's own wire shape. Orders never sees this directly -- only through the client below.
type ProductDto struct {
	Sku            string
	DisplayName    string
	UnitPriceCents int
}

// InventoryService is the Inventory microservice: its own process, its own private store.
type InventoryService struct {
	Calls    int
	products map[string]ProductDto
}

func NewInventoryService() *InventoryService {
	return &InventoryService{products: map[string]ProductDto{
		"sku-1": {"sku-1", "Widget", 1999},
		"sku-2": {"sku-2", "Gadget", 2999},
	}}
}

func (s *InventoryService) FindProduct(sku string) (ProductDto, error) {
	s.Calls++
	dto, ok := s.products[sku]
	if !ok {
		return ProductDto{}, fmt.Errorf("product %s not found", sku)
	}
	return dto, nil
}

// [/inventory]

// [inventoryClient]
// InventoryServiceClient is Orders' client proxy for Inventory: same interface
// shape Orders would use for a local call, so Orders never deals with
// Inventory's transport directly (Proxy). It also reads through a cache before
// calling out (Cache-Aside), and converts Inventory's ProductDto into Orders'
// own Product model (Adapter) so Inventory's wire shape never leaks in.
type InventoryServiceClient struct {
	inventory *InventoryService
	cache     map[string]Product
}

func NewInventoryServiceClient(inventory *InventoryService) *InventoryServiceClient {
	return &InventoryServiceClient{inventory: inventory, cache: map[string]Product{}}
}

func (c *InventoryServiceClient) GetProduct(sku string) (Product, error) {
	if cached, ok := c.cache[sku]; ok {
		return cached, nil // cache hit -- Inventory is never called
	}

	dto, err := c.inventory.FindProduct(sku) // cache miss -- load from the service
	if err != nil {
		return Product{}, err
	}
	product := Product{dto.Sku, dto.DisplayName, float64(dto.UnitPriceCents) / 100}
	c.cache[sku] = product // populate the cache for next time
	return product, nil
}

// [/inventoryClient]

// [breaker]
// CircuitBreaker is a deliberately minimal circuit breaker: no timers, no
// clock -- just a failure counter. Once failureThreshold calls in a row have
// failed it opens and stays open, failing every further call immediately
// without ever invoking the wrapped function again.
type CircuitBreaker struct {
	failureThreshold int
	state            string
	failureCount     int
}

func NewCircuitBreaker(failureThreshold int) *CircuitBreaker {
	return &CircuitBreaker{failureThreshold: failureThreshold, state: "CLOSED"}
}

func (b *CircuitBreaker) IsOpen() bool { return b.state == "OPEN" }

func (b *CircuitBreaker) Call(fn func() (string, error)) (string, error) {
	if b.state == "OPEN" {
		return "", errors.New("circuit open -- failing fast") // fn() never runs
	}
	result, err := fn()
	if err != nil {
		b.failureCount++
		if b.failureCount >= b.failureThreshold {
			b.state = "OPEN"
		}
		return "", err
	}
	b.failureCount = 0
	return result, nil
}

// [/breaker]

// [payments]
// PaymentsService is the Payments microservice: its own process, its own private store.
type PaymentsService struct {
	Calls int
	down  bool
}

// SetDown flips the processor's health. Deterministic: only ever changed by an explicit call, never a timer.
func (p *PaymentsService) SetDown(down bool) {
	p.down = down
}

func (p *PaymentsService) Charge(orderID string, amount float64) (string, error) {
	p.Calls++
	if p.down {
		return "", fmt.Errorf("payment processor unavailable for order %s", orderID)
	}
	return fmt.Sprintf("receipt-%s-%v", orderID, amount), nil
}

// [/payments]

// [broker]
// MessageBroker is a simple in-process broker: publishers and subscribers only
// ever know this interface (Pub/Sub). Handlers are a slice, so delivery order
// is subscription order.
type MessageBroker struct {
	subscribers []func(OrderPlacedEvent)
}

func (b *MessageBroker) Subscribe(handler func(OrderPlacedEvent)) {
	b.subscribers = append(b.subscribers, handler)
}

func (b *MessageBroker) Publish(event OrderPlacedEvent) {
	for _, handler := range b.subscribers {
		handler(event)
	}
}

// [/broker]

// [shipping]
// ShippingService is the Shipping microservice. It only ever learns about an order by subscribing to the broker.
type ShippingService struct {
	Received []OrderPlacedEvent
}

func (s *ShippingService) OnOrderPlaced(event OrderPlacedEvent) {
	s.Received = append(s.Received, event)
}

// [/shipping]

// [orders]
// OrderService is the Orders microservice: its own process, with its own
// private store of the orders it has recorded.
type OrderService struct {
	inventoryClient *InventoryServiceClient
	paymentsBreaker *CircuitBreaker
	payments        *PaymentsService
	broker          *MessageBroker
	orders          map[string]OrderRecord
	orderIDs        []string // insertion order, since Go map iteration order is random
}

func NewOrderService(inventoryClient *InventoryServiceClient, paymentsBreaker *CircuitBreaker, payments *PaymentsService, broker *MessageBroker) *OrderService {
	return &OrderService{
		inventoryClient: inventoryClient,
		paymentsBreaker: paymentsBreaker,
		payments:        payments,
		broker:          broker,
		orders:          map[string]OrderRecord{},
	}
}

func (s *OrderService) RecordedOrders() []OrderRecord {
	records := make([]OrderRecord, 0, len(s.orderIDs))
	for _, id := range s.orderIDs {
		records = append(records, s.orders[id])
	}
	return records
}

func (s *OrderService) PlaceOrder(orderID string, lines []OrderLine) (PlaceOrderResult, error) {
	total := 0.0
	for _, line := range lines {
		product, err := s.inventoryClient.GetProduct(line.Sku)
		if err != nil {
			return PlaceOrderResult{}, err
		}
		total += product.Price * float64(line.Quantity)
	}

	reason := ""
	status := "PAID"
	if _, err := s.paymentsBreaker.Call(func() (string, error) { return s.payments.Charge(orderID, total) }); err != nil {
		status = "PAYMENT_FAILED"
		reason = err.Error()
	}

	// Orders records every order it handled in its own private store, paid or not.
	if _, seen := s.orders[orderID]; !seen {
		s.orderIDs = append(s.orderIDs, orderID)
	}
	s.orders[orderID] = OrderRecord{orderID, total, status}

	// Only a paid order is announced -- a failed one never reaches Shipping.
	if status == "PAID" {
		s.broker.Publish(OrderPlacedEvent{orderID, lines, total})
	}

	return PlaceOrderResult{orderID, total, status, reason}, nil
}

// [/orders]

// [gateway]
// ApiGateway is the one entry point clients see, hiding three separate services behind it (Facade).
type ApiGateway struct {
	nextOrderID int // counter-based ids, never timestamps
	orders      *OrderService
}

func NewApiGateway(orders *OrderService) *ApiGateway {
	return &ApiGateway{nextOrderID: 1, orders: orders}
}

func (g *ApiGateway) PlaceOrder(lines []OrderLine) (PlaceOrderResult, error) {
	orderID := fmt.Sprintf("order-%d", g.nextOrderID)
	g.nextOrderID++
	return g.orders.PlaceOrder(orderID, lines)
}

// [/gateway]

func report(order PlaceOrderResult) {
	fmt.Printf("%s: total=$%.2f status=%s reason=\"%s\"\n", order.OrderID, order.Total, order.Status, order.Reason)
}

// place places an order through the gateway and reports it; a Go error return
// stands in for the exceptions the other examples would let propagate.
func place(gateway *ApiGateway, lines ...OrderLine) {
	order, err := gateway.PlaceOrder(lines)
	if err != nil {
		panic(err)
	}
	report(order)
}

// [usage]
func main() {
	inventory := NewInventoryService()
	inventoryClient := NewInventoryServiceClient(inventory)
	payments := &PaymentsService{}
	paymentsBreaker := NewCircuitBreaker(3) // failureThreshold
	broker := &MessageBroker{}
	shipping := &ShippingService{}
	broker.Subscribe(shipping.OnOrderPlaced)
	orders := NewOrderService(inventoryClient, paymentsBreaker, payments, broker)
	gateway := NewApiGateway(orders)

	// Order 1: two lines, same sku -- the second lookup is a cache hit. Payments is healthy, so it is paid.
	place(gateway, OrderLine{"sku-1", 1}, OrderLine{"sku-1", 2})

	// The payment processor goes down -- deterministic, flipped explicitly, not by a timer.
	payments.SetDown(true)

	// Orders 2, 3 and 4: the processor is down for all three, so the breaker counts three
	// failures in a row and trips open on the third one.
	place(gateway, OrderLine{"sku-2", 1})
	place(gateway, OrderLine{"sku-2", 1})
	place(gateway, OrderLine{"sku-1", 1})
	breakerState := "CLOSED"
	if paymentsBreaker.IsOpen() {
		breakerState = "OPEN"
	}
	fmt.Printf("PaymentsService calls so far: %d, breaker=%s\n", payments.Calls, breakerState)

	// Order 5: the breaker is now open -- it fails fast, PaymentsService.Charge is never called.
	place(gateway, OrderLine{"sku-2", 1})
	fmt.Printf("PaymentsService calls after breaker opened: %d\n", payments.Calls)

	fmt.Printf("InventoryService product lookups: %d\n", inventory.Calls)
	paidCount := 0
	for _, o := range orders.RecordedOrders() {
		if o.Status == "PAID" {
			paidCount++
		}
	}
	fmt.Printf("OrderService recorded %d orders, %d paid\n", len(orders.RecordedOrders()), paidCount)
	fmt.Printf("ShippingService received %d OrderPlaced events\n", len(shipping.Received))
}

// [/usage]
