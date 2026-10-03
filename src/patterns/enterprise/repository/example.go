package main

import (
	"fmt"
	"math"
	"strings"
)

// [order]
type Order struct {
	ID         string
	CustomerID string
	Total      float64
}

// [/order]

// [orderRepository]
// Go interfaces are satisfied implicitly: both repositories below match this
// method set without declaring that they implement it. Go has no optional
// return, so FindByID returns (*Order, bool).
type OrderRepository interface {
	FindByID(id string) (*Order, bool)
	FindByCustomer(customerID string) []*Order
	Add(order *Order)
	Save(order *Order) // persists changes to an already-added Order
	Remove(id string)
}

// [/orderRepository]

// [database]
type Row map[string]any

type Database struct{}

func (Database) Query(sql string, params []any) []Row {
	// Print params the way the other languages do: strings quoted with '.
	shown := make([]string, len(params))
	for i, p := range params {
		if str, ok := p.(string); ok {
			shown[i] = "'" + str + "'"
		} else {
			shown[i] = fmt.Sprint(p)
		}
	}
	fmt.Println("SQL:", sql, "["+strings.Join(shown, ", ")+"]")
	return []Row{{"id": "482", "customer_id": "cst-9", "total_cents": 4200}}
}

// [/database]

// [sqlOrderRepository]
type SqlOrderRepository struct {
	db Database
}

// [findById]
func (r *SqlOrderRepository) FindByID(id string) (*Order, bool) {
	rows := r.db.Query("SELECT * FROM orders WHERE id = ?", []any{id})
	if len(rows) == 0 {
		return nil, false
	}
	return r.mapRow(rows[0]), true
}

// [/findById]

func (r *SqlOrderRepository) FindByCustomer(customerID string) []*Order {
	rows := r.db.Query("SELECT * FROM orders WHERE customer_id = ?", []any{customerID})
	orders := []*Order{}
	for _, row := range rows {
		orders = append(orders, r.mapRow(row))
	}
	return orders
}

func (r *SqlOrderRepository) Add(order *Order) {
	// math.Round rounds halves away from zero, matching the other language tabs.
	r.db.Query("INSERT INTO orders (id, customer_id, total_cents) VALUES (?, ?, ?)",
		[]any{order.ID, order.CustomerID, int(math.Round(order.Total * 100))})
}

func (r *SqlOrderRepository) Save(order *Order) {
	// An update path for an Order already added — see the Unit of Work pattern
	// for batching several such changes into a single transaction.
	r.db.Query("UPDATE orders SET customer_id = ?, total_cents = ? WHERE id = ?",
		[]any{order.CustomerID, int(math.Round(order.Total * 100)), order.ID})
}

func (r *SqlOrderRepository) Remove(id string) {
	r.db.Query("DELETE FROM orders WHERE id = ?", []any{id})
}

// [mapRow]
func (r *SqlOrderRepository) mapRow(row Row) *Order {
	return &Order{row["id"].(string), row["customer_id"].(string), float64(row["total_cents"].(int)) / 100}
}

// [/mapRow]

// [/sqlOrderRepository]

// [inMemoryOrderRepository]
type InMemoryOrderRepository struct {
	orders map[string]*Order
	order  []string // insertion order, because Go map iteration order is random
}

func NewInMemoryOrderRepository() *InMemoryOrderRepository {
	return &InMemoryOrderRepository{orders: map[string]*Order{}}
}

func (r *InMemoryOrderRepository) FindByID(id string) (*Order, bool) {
	order, ok := r.orders[id]
	return order, ok
}

func (r *InMemoryOrderRepository) FindByCustomer(customerID string) []*Order {
	result := []*Order{}
	for _, id := range r.order {
		if r.orders[id].CustomerID == customerID {
			result = append(result, r.orders[id])
		}
	}
	return result
}

func (r *InMemoryOrderRepository) Add(order *Order) {
	if _, exists := r.orders[order.ID]; !exists {
		r.order = append(r.order, order.ID)
	}
	r.orders[order.ID] = order
}

func (r *InMemoryOrderRepository) Save(order *Order) {
	r.Add(order) // map assignment already overwrites, so add and save coincide here
}

func (r *InMemoryOrderRepository) Remove(id string) {
	delete(r.orders, id)
	for i, existing := range r.order {
		if existing == id {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}
}

// [/inMemoryOrderRepository]

// [client]
type OrderService struct {
	repo OrderRepository
}

func (s *OrderService) GetReceipt(orderID string) string {
	order, ok := s.repo.FindByID(orderID)
	if !ok {
		return "not found"
	}
	return fmt.Sprintf("Order %s: $%.2f", order.ID, order.Total)
}

// [/client]

// [usage]
func main() {
	// Production: wired to the real database
	service := &OrderService{&SqlOrderRepository{Database{}}}
	fmt.Println(service.GetReceipt("482"))

	// Tests: the exact same service, wired to an in-memory stand-in — no database involved
	fakeRepo := NewInMemoryOrderRepository()
	fakeRepo.Add(&Order{"482", "cst-9", 42})
	testService := &OrderService{fakeRepo}
	fmt.Println(testService.GetReceipt("482")) // reads straight out of the map, no SQL involved
}

// [/usage]
