package main

import (
	"fmt"
	"strings"
)

// [http]
// Reply is what either system answers: a status code and a body.
type Reply struct {
	Status int
	Body   string
}

// Target names the system a feature is routed to.
type Target string

const (
	TargetLegacy Target = "legacy"
	TargetModern Target = "modern"
)

// Routed is what the facade hands back: the reply plus which system produced it.
type Routed struct {
	Status   int
	Body     string
	ServedBy Target
}

// parsePath: "/products" -> ("products", ""), "/orders/42" -> ("orders", "42").
func parsePath(path string) (feature string, id string) {
	parts := strings.Split(path, "/") // "/orders/42" -> ["", "orders", "42"]
	if len(parts) > 1 {
		feature = parts[1]
	}
	if len(parts) > 2 {
		id = parts[2]
	}
	return feature, id
}

// [/http]

// [legacy]
type OrderRecord struct {
	ID    string
	Items int
}

// findOrder is a linear search; it returns nil when no order has that id.
func findOrder(orders []OrderRecord, id string) *OrderRecord {
	for i := range orders {
		if orders[i].ID == id {
			return &orders[i]
		}
	}
	return nil
}

// LegacyMonolith is the old code being strangled. It is never edited during the migration.
type LegacyMonolith struct {
	Calls    int
	products []string
	orders   []OrderRecord
}

func NewLegacyMonolith() *LegacyMonolith {
	return &LegacyMonolith{
		products: []string{"p-1", "p-2", "p-3"},
		orders:   []OrderRecord{{ID: "42", Items: 2}},
	}
}

func (l *LegacyMonolith) Handle(path string) Reply {
	l.Calls++
	feature, id := parsePath(path)
	order := findOrder(l.orders, id)
	switch feature {
	case "products":
		return Reply{200, fmt.Sprintf("%d products", len(l.products))}
	case "orders":
		if order != nil {
			return Reply{200, fmt.Sprintf("order %s, %d items", order.ID, order.Items)}
		}
		return Reply{404, fmt.Sprintf("order %s not found", id)}
	case "invoices":
		if order != nil {
			return Reply{200, fmt.Sprintf("invoice for order %s: %d lines", order.ID, order.Items)}
		}
		return Reply{404, fmt.Sprintf("order %s not found", id)}
	default:
		panic(fmt.Sprintf("legacy has no feature %q", feature)) // programmer bug, never exercised
	}
}

// OrdersSnapshot returns a copy of the order list, which the migration reads.
func (l *LegacyMonolith) OrdersSnapshot() []OrderRecord {
	return append([]OrderRecord(nil), l.orders...)
}

// [/legacy]

// [modern]
type ModernService struct {
	Calls int
	// The modern catalog was built with its own copy of the products before this example starts.
	products []string
	orders   []OrderRecord // empty until the migration imports orders
}

func NewModernService() *ModernService {
	return &ModernService{products: []string{"p-1", "p-2", "p-3"}}
}

func (m *ModernService) ImportOrder(record OrderRecord) {
	m.orders = append(m.orders, record) // record was passed by value, so this stores a copy
}

func (m *ModernService) Handle(path string) Reply {
	m.Calls++
	feature, id := parsePath(path)
	order := findOrder(m.orders, id)
	switch feature {
	case "products":
		return Reply{200, fmt.Sprintf("%d products", len(m.products))}
	case "orders":
		if order != nil {
			return Reply{200, fmt.Sprintf("order %s, %d items", order.ID, order.Items)}
		}
		return Reply{404, fmt.Sprintf("order %s not found", id)} // a wrong answer, not a crash
	case "invoices":
		if order != nil {
			return Reply{200, fmt.Sprintf("invoice for order %s: %d lines", order.ID, order.Items)}
		}
		return Reply{404, fmt.Sprintf("order %s not found", id)}
	default:
		panic(fmt.Sprintf("modern has no feature %q", feature)) // programmer bug, never exercised
	}
}

// [/modern]

// [migration]
// Moving the data is usually the hard part (dual writes, change data capture, sync jobs).
// One explicit copy stands in for all of that here.
func copyOrders(legacy *LegacyMonolith, modern *ModernService) int {
	records := legacy.OrdersSnapshot()
	for _, record := range records {
		modern.ImportOrder(record)
	}
	fmt.Printf("[migration] orders copied to the modern store: %d\n", len(records))
	return len(records)
}

// [/migration]

// [facade]
var features = []string{"products", "orders", "invoices"}

// StranglerFacade: real facades are reverse proxies, API gateways or load-balancer rules,
// sometimes with feature flags or a percentage of traffic. Here the facade is an in-process
// object, and a feature moves all at once by an explicit call.
type StranglerFacade struct {
	Retired bool
	legacy  *LegacyMonolith
	modern  *ModernService
	routes  map[string]Target // only ever read by key, never ranged over
}

func NewStranglerFacade(legacy *LegacyMonolith, modern *ModernService) *StranglerFacade {
	routes := make(map[string]Target)
	for _, f := range features {
		routes[f] = TargetLegacy
	}
	return &StranglerFacade{legacy: legacy, modern: modern, routes: routes}
}

func (f *StranglerFacade) Handle(path string) Routed {
	feature, _ := parsePath(path)
	target, ok := f.routes[feature]
	if !ok {
		panic(fmt.Sprintf("facade has no route for %q", feature)) // programmer bug, never exercised
	}
	var reply Reply
	if target == TargetLegacy {
		reply = f.legacy.Handle(path)
	} else {
		reply = f.modern.Handle(path)
	}
	return Routed{Status: reply.Status, Body: reply.Body, ServedBy: target}
}

func (f *StranglerFacade) Migrate(feature string) {
	f.routes[feature] = TargetModern
	fmt.Printf("[facade] %s -> modern\n", feature)
}

// Rollback only works here because nothing is written in this scenario, so the legacy side
// still has current data. In a real system, writes made through the modern side must flow
// back to the legacy side, or a rollback loses them.
func (f *StranglerFacade) Rollback(feature string) {
	f.routes[feature] = TargetLegacy
	fmt.Printf("[facade] %s -> legacy (rollback)\n", feature)
}

// RetireLegacy: the legacy system can go only when no feature is routed to it.
func (f *StranglerFacade) RetireLegacy() bool {
	var stillLegacy []string
	for _, feature := range features { // the fixed slice, so the order is always the same
		if f.routes[feature] == TargetLegacy {
			stillLegacy = append(stillLegacy, feature)
		}
	}
	if len(stillLegacy) > 0 {
		fmt.Printf("[facade] cannot retire legacy: %s still routed to it\n", strings.Join(stillLegacy, ", "))
		return false
	}
	f.Retired = true
	fmt.Println("[facade] legacy retired")
	return true
}

// [/facade]

// [usage]
func send(facade *StranglerFacade, path string) {
	r := facade.Handle(path)
	fmt.Printf("GET %s -> %d from %s: %s\n", path, r.Status, r.ServedBy, r.Body)
}

func main() {
	legacy := NewLegacyMonolith()
	modern := NewModernService()
	facade := NewStranglerFacade(legacy, modern)

	send(facade, "/products")  // 200 from legacy: 3 products
	send(facade, "/orders/42") // 200 from legacy: order 42, 2 items

	facade.Migrate("products")
	send(facade, "/products") // 200 from modern: 3 products

	facade.Migrate("orders")   // too early: the modern store has no orders yet
	send(facade, "/orders/42") // 404 from modern: order 42 not found
	facade.Rollback("orders")
	send(facade, "/orders/42") // 200 from legacy again

	copyOrders(legacy, modern) // 1 order copied
	facade.Migrate("orders")
	send(facade, "/orders/42") // 200 from modern: order 42, 2 items

	facade.RetireLegacy() // refused: invoices still routed to legacy
	facade.Migrate("invoices")
	send(facade, "/invoices/42") // 200 from modern: invoice for order 42: 2 lines
	facade.RetireLegacy()        // succeeds: nothing routes to legacy any more

	fmt.Printf("calls: legacy %d, modern %d\n", legacy.Calls, modern.Calls) // legacy 3, modern 4
}

// [/usage]
