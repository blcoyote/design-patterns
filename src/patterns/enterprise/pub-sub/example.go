package main

import (
	"fmt"
	"slices"
)

// Payloads are plain structs. Their String methods only make the analytics
// line print the same text in every language.
type OrderPlaced struct {
	OrderID string
	Total   int
}

func (e OrderPlaced) String() string {
	return fmt.Sprintf("OrderPlaced(order_id='%s', total=%d)", e.OrderID, e.Total)
}

type UserSignedUp struct {
	UserID string
	Email  string
}

func (e UserSignedUp) String() string {
	return fmt.Sprintf("UserSignedUp(user_id='%s', email='%s')", e.UserID, e.Email)
}

type Unsubscribe func()

// subscription is a pointer-identified entry, because Go funcs are not
// comparable and so cannot be found in a slice by value.
type subscription struct {
	handler func(any)
}

// [eventBus]
// Go methods cannot have type parameters, so the typed Subscribe is a
// package-level generic function. A slice per topic keeps delivery in
// subscription order (map iteration order would be random).
type EventBus struct {
	topics map[string][]*subscription
}

func NewEventBus() *EventBus {
	return &EventBus{topics: map[string][]*subscription{}}
}

// [subscribe]
func Subscribe[T any](bus *EventBus, topic string, handler func(T)) Unsubscribe {
	sub := &subscription{handler: func(payload any) { handler(payload.(T)) }}
	bus.topics[topic] = append(bus.topics[topic], sub)
	return func() {
		bus.topics[topic] = slices.DeleteFunc(bus.topics[topic], func(s *subscription) bool { return s == sub })
	}
}

// [/subscribe]

func (b *EventBus) Publish(topic string, payload any) {
	// [dispatch]
	// Loop over a snapshot so a handler that subscribes or unsubscribes
	// mid-publish doesn't affect the round we're already delivering.
	for _, sub := range slices.Clone(b.topics[topic]) {
		sub.handler(payload)
	}
	// [/dispatch]
}

// [/eventBus]

// [checkoutService]
type CheckoutService struct {
	bus *EventBus
}

func (s *CheckoutService) PlaceOrder(orderID string, total int) {
	// ...charge the card, persist the order...
	// [checkoutPublish]
	s.bus.Publish("order.placed", OrderPlaced{orderID, total})
	// [/checkoutPublish]
}

// [/checkoutService]

// [userService]
type UserService struct {
	bus *EventBus
}

func (s *UserService) SignUp(userID, email string) {
	// ...create the account...
	// [userPublish]
	s.bus.Publish("user.signedUp", UserSignedUp{userID, email})
	// [/userPublish]
}

// [/userService]

// [emailService]
type EmailService struct{}

func NewEmailService(bus *EventBus) *EmailService {
	s := &EmailService{}
	Subscribe(bus, "order.placed", func(e OrderPlaced) { s.sendReceipt(e.OrderID) })
	Subscribe(bus, "user.signedUp", func(e UserSignedUp) { s.sendWelcome(e.Email) })
	return s
}

func (s *EmailService) sendReceipt(orderID string) {
	fmt.Printf("email: receipt for order %s\n", orderID)
}

func (s *EmailService) sendWelcome(email string) {
	fmt.Printf("email: welcome %s\n", email)
}

// [/emailService]

// [analyticsService]
type AnalyticsService struct{}

func NewAnalyticsService(bus *EventBus) *AnalyticsService {
	s := &AnalyticsService{}
	Subscribe(bus, "order.placed", func(e OrderPlaced) { s.track("order.placed", e) })
	Subscribe(bus, "user.signedUp", func(e UserSignedUp) { s.track("user.signedUp", e) })
	return s
}

func (s *AnalyticsService) track(topic string, payload any) {
	fmt.Printf("analytics: %s %v\n", topic, payload)
}

// [/analyticsService]

// [inventoryService]
type InventoryService struct {
	stopListening Unsubscribe
}

func NewInventoryService(bus *EventBus) *InventoryService {
	s := &InventoryService{}
	s.stopListening = Subscribe(bus, "order.placed", func(e OrderPlaced) { s.reserve(e.OrderID) })
	return s
}

func (s *InventoryService) reserve(orderID string) {
	fmt.Printf("inventory: reserved stock for %s\n", orderID)
}

// [unsubscribe]
func (s *InventoryService) StopWatching() {
	s.stopListening()
}

// [/unsubscribe]

// [/inventoryService]

// Usage — nobody imports anybody else, only EventBus
func main() {
	bus := NewEventBus()
	checkout := &CheckoutService{bus}
	users := &UserService{bus}
	NewEmailService(bus)
	NewAnalyticsService(bus)
	inventory := NewInventoryService(bus)

	checkout.PlaceOrder("A1", 42)         // email, analytics and inventory all react
	users.SignUp("U1", "ada@example.com") // only email and analytics react

	inventory.StopWatching()
	checkout.PlaceOrder("A2", 15) // email and analytics react; inventory does not
}
