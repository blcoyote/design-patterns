package main

import "fmt"

// [events]
type OrderPlaced struct {
	OrderID  int
	Item     string
	Quantity int
}

type StockReserved struct {
	OrderID int
	Item    string
}

// [/events]

// [broker]
type QueuedMessage struct {
	Topic string
	Event any
}

// EventBroker keeps a list of handlers per topic and an explicit, drainable queue.
// Publishing only enqueues a message — it never calls a handler directly, and
// draining is FIFO, so delivery order is deterministic and identical across languages.
type EventBroker struct {
	// Handlers per topic. The map is only ever looked up by key, never ranged
	// over (Go map iteration order is random), so delivery order stays the
	// subscription order within each topic's slice.
	subscribers map[string][]func(any)
	queue       []QueuedMessage
}

func NewEventBroker() *EventBroker {
	return &EventBroker{subscribers: map[string][]func(any){}}
}

func (b *EventBroker) Subscribe(topic string, handler func(any)) {
	b.subscribers[topic] = append(b.subscribers[topic], handler)
}

func (b *EventBroker) Publish(topic string, event any) {
	// The publisher only knows a topic name, never a handler — adding or removing
	// a subscriber never requires touching this method or its caller.
	b.queue = append(b.queue, QueuedMessage{topic, event})
}

// Drain drains the queue FIFO, including messages a handler enqueues while draining (choreography).
func (b *EventBroker) Drain() {
	for len(b.queue) > 0 {
		message := b.queue[0]
		b.queue = b.queue[1:]
		for _, handler := range b.subscribers[message.Topic] {
			handler(message.Event)
		}
	}
}

// [/broker]

// [dedupe]
// Dedupe is the consumer-side handler pipeline (a tiny Chain of Responsibility):
// it wraps a handler so a redelivered message with an OrderID already seen is
// dropped before it reaches the real handler. This lives on the consumer, not
// the broker — the broker has no idea deduplication is happening.
func Dedupe(handler func(any)) func(any) {
	seen := map[int]bool{}
	return func(event any) {
		orderPlaced := event.(OrderPlaced)
		if seen[orderPlaced.OrderID] {
			fmt.Printf("[inventory] duplicate OrderPlaced(%d) ignored\n", orderPlaced.OrderID)
			return
		}
		seen[orderPlaced.OrderID] = true
		handler(event)
	}
}

// [/dedupe]

// [email]
type EmailConsumer struct{}

func (c *EmailConsumer) OnOrderPlaced(event any) {
	e := event.(OrderPlaced)
	fmt.Printf("[email] confirmation sent for order %d (%d x %s)\n", e.OrderID, e.Quantity, e.Item)
}

// [/email]

// [inventory]
type InventoryConsumer struct {
	broker *EventBroker
}

func NewInventoryConsumer(broker *EventBroker) *InventoryConsumer {
	return &InventoryConsumer{broker: broker}
}

func (c *InventoryConsumer) OnOrderPlaced(event any) {
	e := event.(OrderPlaced)
	fmt.Printf("[inventory] reserved %d x %s for order %d\n", e.Quantity, e.Item, e.OrderID)
	// Choreography: Inventory decides on its own to publish the next event — nothing
	// orchestrates this, and the broker itself has no idea what topic comes next.
	stockReserved := StockReserved{e.OrderID, e.Item}
	c.broker.Publish("StockReserved", stockReserved)
}

// [/inventory]

// [analytics]
type AnalyticsConsumer struct {
	Count int
}

func (c *AnalyticsConsumer) OnOrderPlaced(_ any) {
	c.Count++
	fmt.Printf("[analytics] order count: %d\n", c.Count)
}

// [/analytics]

// [loyalty]
// Added after the system is already running, subscribing to the exact same topic.
// OrdersProducer below is never touched to make this consumer exist.
type LoyaltyConsumer struct{}

func (c *LoyaltyConsumer) OnOrderPlaced(event any) {
	e := event.(OrderPlaced)
	fmt.Printf("[loyalty] points awarded for order %d\n", e.OrderID)
}

// [/loyalty]

// [producer]
type OrdersProducer struct {
	broker      *EventBroker
	nextOrderID int
}

func NewOrdersProducer(broker *EventBroker) *OrdersProducer {
	return &OrdersProducer{broker: broker, nextOrderID: 1}
}

func (p *OrdersProducer) PlaceOrder(item string, quantity int) int {
	orderID := p.nextOrderID
	p.nextOrderID++
	event := OrderPlaced{orderID, item, quantity}
	// The producer depends on the broker and a topic name only — not on a single
	// consumer, and not on how many consumers (zero or a dozen) are listening.
	p.broker.Publish("OrderPlaced", event)
	return orderID
}

// Redeliver simulates a duplicate delivery, as an at-least-once broker redelivery or a
// producer retry after a lost ack would cause, by publishing the same event again.
func (p *OrdersProducer) Redeliver(orderID int, item string, quantity int) {
	event := OrderPlaced{orderID, item, quantity}
	p.broker.Publish("OrderPlaced", event)
}

// [/producer]

// Usage
// [usage]
func main() {
	broker := NewEventBroker()
	email := &EmailConsumer{}
	inventory := NewInventoryConsumer(broker)
	analytics := &AnalyticsConsumer{}

	broker.Subscribe("OrderPlaced", email.OnOrderPlaced)
	broker.Subscribe("OrderPlaced", Dedupe(inventory.OnOrderPlaced))
	broker.Subscribe("OrderPlaced", analytics.OnOrderPlaced)

	producer := NewOrdersProducer(broker)

	orderID := producer.PlaceOrder("WIDGET", 2)
	broker.Drain()

	// At-least-once redelivery: Inventory's dedupe pipeline recognizes order 1 and drops
	// it; Email and Analytics have no such pipeline, so they process it again.
	producer.Redeliver(orderID, "WIDGET", 2)
	broker.Drain()

	// Adding a consumer requires no change to OrdersProducer, EventBroker, or any other
	// consumer — only a new Subscribe() call.
	loyalty := &LoyaltyConsumer{}
	broker.Subscribe("OrderPlaced", loyalty.OnOrderPlaced)

	producer.PlaceOrder("GADGET", 1)
	broker.Drain()
}

// [/usage]
