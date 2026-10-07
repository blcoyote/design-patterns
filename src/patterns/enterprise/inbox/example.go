package main

import (
	"errors"
	"fmt"
)

// A message as the broker delivers it. The ID is assigned by the producer
// (for example the outbox row id), so it is the same on every redelivery.
type OrderPlaced struct {
	ID      int
	OrderID string
}

// [database]
// Returned when an inbox id already exists, like a primary-key violation.
var ErrDuplicateKey = errors.New("duplicate inbox id")

// An in-memory stand-in for ONE relational database that holds both the
// business table (shipments) and the inbox table (ids already processed).
type Tx struct {
	inboxIDs  []int
	shipments []string
}

func (tx *Tx) InsertInbox(id int) {
	tx.inboxIDs = append(tx.inboxIDs, id)
}

func (tx *Tx) InsertShipment(orderID string) {
	tx.shipments = append(tx.shipments, orderID)
}

type Database struct {
	inbox     map[int]bool
	Shipments []string
	// Fault injection for the demo: the next transaction fails before it
	// commits, as if the connection dropped mid-handler.
	FailNextCommit bool
}

func NewDatabase() *Database {
	return &Database{inbox: map[int]bool{}}
}

// [dbSeen]
// A cheap pre-check. It is not the guard: two concurrent deliveries can both
// pass it, so Transaction enforces the unique inbox id at commit.
func (db *Database) AlreadyProcessed(id int) bool {
	return db.inbox[id]
}

// [/dbSeen]

// [transaction]
// Stands in for BEGIN … COMMIT: the writes are staged and applied together
// only if work returns and the commit succeeds, so a failure leaves both
// tables untouched. An inbox id that already exists violates the primary key
// and rolls the whole transaction back, shipment included. (This stand-in is
// single-threaded; a real database makes the check-and-insert atomic.)
func (db *Database) Transaction(work func(tx *Tx)) error {
	tx := &Tx{}
	work(tx)
	if db.FailNextCommit {
		db.FailNextCommit = false
		return errors.New("database connection lost")
	}
	for _, id := range tx.inboxIDs {
		if db.inbox[id] {
			return ErrDuplicateKey
		}
	}
	for _, id := range tx.inboxIDs {
		db.inbox[id] = true
	}
	db.Shipments = append(db.Shipments, tx.shipments...)
	fmt.Printf("db: inbox #%d + shipment %s saved\n", tx.inboxIDs[0], tx.shipments[0])
	return nil
}

// [/transaction]
// [/database]

// [messageBroker]
type Handler func(message OrderPlaced) error

type MessageBroker struct {
	handlers []Handler
	// Fault injection for the demo: the next acknowledgement never arrives.
	DropNextAck bool
}

func (b *MessageBroker) Subscribe(handler Handler) {
	b.handlers = append(b.handlers, handler)
}

func (b *MessageBroker) Publish(message OrderPlaced) {
	// [deliver]
	// At-least-once: keep delivering until a handler returns and its
	// acknowledgement arrives. A failure or a lost ack both mean "try again".
	for {
		var err error
		for _, handler := range append([]Handler(nil), b.handlers...) {
			if err = handler(message); err != nil {
				break
			}
		}
		if err != nil {
			fmt.Printf("broker: message %d failed (%v), redelivering\n", message.ID, err)
			continue
		}
		if b.DropNextAck {
			b.DropNextAck = false
			fmt.Printf("broker: ack for message %d lost, redelivering\n", message.ID)
			continue
		}
		fmt.Printf("broker: message %d acked\n", message.ID)
		return
	}
	// [/deliver]
}

// [/messageBroker]

// [shippingConsumer]
type ShippingConsumer struct {
	db *Database
}

func NewShippingConsumer(db *Database, broker *MessageBroker) *ShippingConsumer {
	c := &ShippingConsumer{db: db}
	broker.Subscribe(c.onOrderPlaced)
	return c
}

func (c *ShippingConsumer) onOrderPlaced(message OrderPlaced) error {
	fmt.Printf("shipping: received message %d\n", message.ID)
	// [inboxCheck]
	// Seen this id before? Then the work was already done: do nothing and
	// return normally, so the broker gets its ack and stops redelivering.
	if c.db.AlreadyProcessed(message.ID) {
		fmt.Printf("shipping: message %d already in inbox, ignored\n", message.ID)
		return nil
	}
	// [/inboxCheck]
	// [inboxCommit]
	// The inbox row and the shipment are written in ONE transaction. A crash
	// can never leave "shipped but not recorded" or "recorded but not shipped".
	err := c.db.Transaction(func(tx *Tx) {
		tx.InsertInbox(message.ID)
		tx.InsertShipment(message.OrderID)
	})
	if errors.Is(err, ErrDuplicateKey) {
		// Lost a race with a concurrent delivery of the same message: its
		// transaction won, ours rolled back, so this one is just a duplicate.
		fmt.Printf("shipping: message %d already in inbox, ignored\n", message.ID)
		return nil
	}
	return err
	// [/inboxCommit]
}

// [/shippingConsumer]

func main() {
	// [client]
	db := NewDatabase()
	broker := &MessageBroker{}
	NewShippingConsumer(db, broker)

	db.FailNextCommit = true  // attempt 1 dies inside the transaction
	broker.DropNextAck = true // attempt 2 succeeds, but its ack is lost
	broker.Publish(OrderPlaced{ID: 1, OrderID: "A1"})
	// shipping: received message 1
	// broker: message 1 failed (database connection lost), redelivering
	// shipping: received message 1
	// db: inbox #1 + shipment A1 saved
	// broker: ack for message 1 lost, redelivering
	// shipping: received message 1
	// shipping: message 1 already in inbox, ignored
	// broker: message 1 acked

	fmt.Printf("shipments: %d\n", len(db.Shipments))
	// shipments: 1
	// [/client]
}
