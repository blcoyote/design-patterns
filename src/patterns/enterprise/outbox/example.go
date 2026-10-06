package main

import (
	"errors"
	"fmt"
)

type OrderPlaced struct {
	OrderID string
	Total   int
}

// One row of the outbox table. The ID is a counter, so it is stable across retries.
type OutboxMessage struct {
	ID        int
	Topic     string
	Payload   OrderPlaced
	Published bool
}

// [database]
// An in-memory stand-in for ONE relational database that holds both the
// business table (orders) and the outbox table.
type Tx struct {
	orders   []OrderPlaced
	messages []OutboxMessage // ID and Published are filled in on commit
}

func (tx *Tx) InsertOrder(order OrderPlaced) {
	tx.orders = append(tx.orders, order)
}

func (tx *Tx) InsertOutbox(topic string, payload OrderPlaced) {
	tx.messages = append(tx.messages, OutboxMessage{Topic: topic, Payload: payload})
}

type Database struct {
	orders        []OrderPlaced
	outbox        []OutboxMessage
	nextMessageID int
	// Fault injection for the demo: the next MarkPublished fails, as if the
	// relay lost its database connection right after publishing.
	FailNextMark bool
}

func NewDatabase() *Database {
	return &Database{nextMessageID: 1}
}

// [transaction]
// Stands in for BEGIN … COMMIT: the writes are staged and applied together
// only if work returns, so a failure leaves both tables untouched.
func (d *Database) Transaction(work func(tx *Tx)) {
	tx := &Tx{}
	work(tx)
	for _, order := range tx.orders {
		d.orders = append(d.orders, order)
		fmt.Printf("db: order %s saved\n", order.OrderID)
	}
	for _, m := range tx.messages {
		m.ID = d.nextMessageID
		d.nextMessageID++
		d.outbox = append(d.outbox, m)
		fmt.Printf("db: outbox #%d %s pending\n", m.ID, m.Topic)
	}
}

// [/transaction]

// [dbPending]
// Oldest first; a new slice of copies is returned, so callers iterate a snapshot.
func (d *Database) PendingMessages() []OutboxMessage {
	var pending []OutboxMessage
	for _, m := range d.outbox {
		if !m.Published {
			pending = append(pending, m)
		}
	}
	return pending
}

// [/dbPending]

// [dbMark]
func (d *Database) MarkPublished(id int) error {
	if d.FailNextMark {
		d.FailNextMark = false
		return errors.New("database connection lost")
	}
	for i := range d.outbox {
		if d.outbox[i].ID == id {
			d.outbox[i].Published = true
		}
	}
	return nil
}

// [/dbMark]

// [/database]

// [orderService]
type OrderService struct {
	db *Database
}

func (s *OrderService) PlaceOrder(orderID string, total int) {
	// [placeOrder]
	// No broker call here. The event goes into the outbox table in the same
	// transaction as the order, so either both are saved or neither is.
	s.db.Transaction(func(tx *Tx) {
		tx.InsertOrder(OrderPlaced{orderID, total})
		tx.InsertOutbox("order.placed", OrderPlaced{orderID, total})
	})
	// [/placeOrder]
}

// [/orderService]

// [messageBroker]
type Handler func(message OutboxMessage)

type MessageBroker struct {
	handlers map[string][]Handler
}

func NewMessageBroker() *MessageBroker {
	return &MessageBroker{handlers: map[string][]Handler{}}
}

func (b *MessageBroker) Subscribe(topic string, handler Handler) {
	b.handlers[topic] = append(b.handlers[topic], handler)
}

func (b *MessageBroker) Publish(message OutboxMessage) {
	// [deliver]
	for _, handler := range append([]Handler(nil), b.handlers[message.Topic]...) {
		handler(message)
	}
	// [/deliver]
}

// [/messageBroker]

// [outboxRelay]
type OutboxRelay struct {
	db     *Database
	broker *MessageBroker
}

// Called on a schedule in real systems; main below calls it by hand.
func (r *OutboxRelay) Poll() {
	// [relayPoll]
	pending := r.db.PendingMessages()
	// [/relayPoll]
	if len(pending) == 0 {
		fmt.Println("relay: nothing pending")
		return
	}
	for _, message := range pending {
		// [relayPublish]
		r.broker.Publish(message)
		// [/relayPublish]
		// [relayMark]
		// A failure between publish and mark leaves the row pending, so the
		// next poll publishes it again: delivery is at-least-once.
		if err := r.db.MarkPublished(message.ID); err != nil {
			fmt.Printf("relay: #%d failed (%s), stays pending\n", message.ID, err)
			break // keep order: don't publish later messages ahead of this one
		}
		// [/relayMark]
		fmt.Printf("relay: #%d marked published\n", message.ID)
	}
}

// [/outboxRelay]

// [shippingConsumer]
type ShippingConsumer struct {
	handled map[int]bool // only membership is checked, never iterated
}

func NewShippingConsumer(broker *MessageBroker) *ShippingConsumer {
	c := &ShippingConsumer{handled: map[int]bool{}}
	broker.Subscribe("order.placed", c.onOrderPlaced)
	return c
}

func (c *ShippingConsumer) onOrderPlaced(message OutboxMessage) {
	// [dedupe]
	// At-least-once delivery means the same message can arrive twice, so the
	// consumer remembers the ids it has already handled.
	if c.handled[message.ID] {
		fmt.Printf("shipping: message %d already handled, ignored\n", message.ID)
		return
	}
	c.handled[message.ID] = true
	// [/dedupe]
	fmt.Printf("shipping: ship order %s (message %d)\n", message.Payload.OrderID, message.ID)
}

// [/shippingConsumer]

func main() {
	// [client]
	db := NewDatabase()
	broker := NewMessageBroker()
	orders := &OrderService{db}
	relay := &OutboxRelay{db, broker}
	NewShippingConsumer(broker)

	orders.PlaceOrder("A1", 42)
	// db: order A1 saved
	// db: outbox #1 order.placed pending

	db.FailNextMark = true // the relay publishes #1, then loses its connection
	relay.Poll()
	// shipping: ship order A1 (message 1)
	// relay: #1 failed (database connection lost), stays pending

	relay.Poll() // #1 is still pending, so it is published again
	// shipping: message 1 already handled, ignored
	// relay: #1 marked published

	relay.Poll()
	// relay: nothing pending
	// [/client]
}
