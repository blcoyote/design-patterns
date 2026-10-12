package main

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

// [contracts]
// The public contracts the modules share (a "published language"). Nothing internal lives
// here: no module's records, stores or implementation structs, only what crosses a boundary.

// ProductInfo is what Catalog's API returns. Deliberately NOT Catalog's internal record.
type ProductInfo struct {
	Sku        string
	Name       string
	PriceCents int
}

type CatalogAPI interface {
	GetProduct(sku string) (ProductInfo, bool)
	SetPrice(sku string, priceCents int)
}

type OrderLineRequest struct {
	Sku      string
	Quantity int
}

// PlaceOrderResult: a rejection is a normal result, not an error: OrderID is "" and Reason is set.
type PlaceOrderResult struct {
	Accepted   bool
	OrderID    string // empty string when the order was rejected
	TotalCents int
	Reason     string // empty string when the order was accepted
}

type OrderingAPI interface {
	PlaceOrder(customerID string, lines []OrderLineRequest) PlaceOrderResult
	OrderTotal(orderID string) (int, bool)
}

// OrderPlaced is the integration event Ordering publishes. Shipping depends on this shape, not on Ordering.
type OrderPlaced struct {
	OrderID    string
	CustomerID string
	TotalCents int
}

type ShippingAPI interface {
	// StatusFor returns "ready to ship" or "unknown".
	StatusFor(orderID string) string
}

// Go has no mapped types, so there is no ModuleApis map from module name to API type.
// The host stores each API as any under the module's name and callers type-assert it.

// formatCents: money is integer cents everywhere. Formats 6997 as "69.97" with integer arithmetic only (no floats).
func formatCents(cents int) string {
	return fmt.Sprintf("%d.%02d", cents/100, cents%100)
}

// [/contracts]

// [eventBus]
type OrderPlacedHandler func(event OrderPlaced)

// InProcessEventBus is an in-process event bus for OrderPlaced. Publish calls every handler
// synchronously, in subscription order, on the caller's own call stack: same process, so no
// network. A real modular monolith often pairs this with an outbox, so the event commits
// together with the publishing module's own data. This bus has no outbox and does not persist anything.
type InProcessEventBus struct {
	handlers []OrderPlacedHandler
}

func (b *InProcessEventBus) Subscribe(handler OrderPlacedHandler) {
	b.handlers = append(b.handlers, handler)
}

func (b *InProcessEventBus) Publish(event OrderPlaced) {
	for _, handler := range b.handlers {
		handler(event)
	}
}

// [/eventBus]

// [host]
// ModuleContext is what a module's factory receives: the shared bus and a way to reach the modules it declared.
type ModuleContext struct {
	Bus *InProcessEventBus
	// Use returns the target module's API as any: the caller type-asserts it (e.g. api.(CatalogAPI)).
	Use func(target string) (any, error)
}

// ModuleHost is the composition root of the single deployable. It starts each module, hands it a
// ModuleContext, and refuses any lookup of a module the requester did not declare.
type ModuleHost struct {
	// Started holds the names of the started modules, in registration order.
	Started      []string
	bus          *InProcessEventBus
	apis         map[string]any
	dependencies map[string][]string
}

func NewModuleHost(bus *InProcessEventBus) *ModuleHost {
	return &ModuleHost{
		bus:          bus,
		apis:         map[string]any{},
		dependencies: map[string][]string{},
	}
}

// Register is starting: the factory runs immediately and only its returned API is kept.
// The API comes back as any because Go has no mapped types; the caller type-asserts it.
// A factory error is returned as is, and the module is then not started.
func (h *ModuleHost) Register(name string, dependsOn []string, factory func(ctx ModuleContext) (any, error)) (any, error) {
	h.dependencies[name] = dependsOn
	ctx := ModuleContext{
		Bus: h.bus,
		Use: func(target string) (any, error) { return h.Use(name, target) },
	}
	api, err := factory(ctx)
	if err != nil {
		return nil, err
	}
	h.apis[name] = api
	h.Started = append(h.Started, name)
	return api, nil
}

// Use is the boundary check: a module may only reach modules it declared. In a real codebase an
// architecture test enforces the same rule (ArchUnit/NetArchTest, import-linter, Go's internal/ packages).
func (h *ModuleHost) Use(requester, target string) (any, error) {
	if !slices.Contains(h.dependencies[requester], target) {
		return nil, fmt.Errorf("%s does not declare a dependency on %s", requester, target)
	}
	api, ok := h.apis[target]
	if !ok {
		return nil, fmt.Errorf("%s is not started", target)
	}
	return api, nil
}

// [/host]

// [catalog]
// catalogRecord is Catalog's internal record. It never leaves the module: supplierCode is internal only.
type catalogRecord struct {
	sku          string
	name         string
	priceCents   int
	supplierCode string
}

// catalogModule is the Catalog module. In Go the hiding mechanism is an unexported struct
// behind the exported CatalogAPI interface. In this single file everything is one package, so
// the compiler cannot enforce it here; in a real codebase each module is its own package under
// internal/, and then the compiler does enforce that other modules reach only the interface.
type catalogModule struct {
	records map[string]*catalogRecord
}

func NewCatalogModule(ctx ModuleContext) (any, error) {
	return &catalogModule{records: map[string]*catalogRecord{
		"sku-1": {"sku-1", "Widget", 1999, "SUP-W"},
		"sku-2": {"sku-2", "Gadget", 2999, "SUP-G"},
	}}, nil
}

func (m *catalogModule) GetProduct(sku string) (ProductInfo, bool) {
	record, ok := m.records[sku]
	if !ok {
		return ProductInfo{}, false
	}
	// Map the internal record to the public ProductInfo; supplierCode stays inside.
	return ProductInfo{record.sku, record.name, record.priceCents}, true
}

func (m *catalogModule) SetPrice(sku string, priceCents int) {
	record, ok := m.records[sku]
	if !ok {
		return
	}
	record.priceCents = priceCents
	fmt.Printf("[catalog] %s repriced to %s\n", sku, formatCents(priceCents))
}

// [/catalog]

// [ordering]
// storedOrderLine is one stored order line. unitPriceCents is Ordering's own copy, taken at placement time.
type storedOrderLine struct {
	sku            string
	quantity       int
	unitPriceCents int
}

type storedOrder struct {
	orderID    string
	customerID string
	lines      []storedOrderLine
}

// orderingModule is the Ordering module, an unexported struct behind OrderingAPI. Its orders
// live in the struct's unexported field, so other modules reach them only through OrderingAPI.
type orderingModule struct {
	bus             *InProcessEventBus
	catalog         CatalogAPI
	orders          map[string]storedOrder
	nextOrderNumber int // counter-based ids, never timestamps
}

// NewOrderingModule asks the host for Catalog once, at creation: that call succeeds
// only because "catalog" is in Ordering's declared dependencies.
func NewOrderingModule(ctx ModuleContext) (any, error) {
	api, err := ctx.Use("catalog")
	if err != nil {
		return nil, err
	}
	catalog, ok := api.(CatalogAPI)
	if !ok {
		return nil, errors.New("catalog does not implement CatalogAPI")
	}
	return &orderingModule{bus: ctx.Bus, catalog: catalog, orders: map[string]storedOrder{}, nextOrderNumber: 1}, nil
}

func (m *orderingModule) PlaceOrder(customerID string, lines []OrderLineRequest) PlaceOrderResult {
	storedLines := make([]storedOrderLine, 0, len(lines))
	for _, line := range lines {
		product, ok := m.catalog.GetProduct(line.Sku)
		if !ok {
			// Reject before assigning an id: nothing is stored and nothing is published.
			return PlaceOrderResult{Accepted: false, OrderID: "", TotalCents: 0, Reason: "unknown product " + line.Sku}
		}
		storedLines = append(storedLines, storedOrderLine{line.Sku, line.Quantity, product.PriceCents})
	}

	totalCents := 0
	for _, line := range storedLines {
		totalCents += line.unitPriceCents * line.quantity
	}

	orderID := fmt.Sprintf("order-%d", m.nextOrderNumber)
	m.nextOrderNumber++
	m.orders[orderID] = storedOrder{orderID, customerID, storedLines} // save the copied prices
	m.bus.Publish(OrderPlaced{orderID, customerID, totalCents})
	return PlaceOrderResult{Accepted: true, OrderID: orderID, TotalCents: totalCents, Reason: ""}
}

func (m *orderingModule) OrderTotal(orderID string) (int, bool) {
	order, ok := m.orders[orderID]
	if !ok {
		return 0, false
	}
	// Computed from Ordering's own stored copy: Catalog is never called here.
	totalCents := 0
	for _, line := range order.lines {
		totalCents += line.unitPriceCents * line.quantity
	}
	return totalCents, true
}

// [/ordering]

// [shipping]
type shipment struct {
	shipmentID string
	status     string
}

// shippingModule is the Shipping module. It declares no module dependencies: it knows only the
// OrderPlaced contract and learns about orders by subscribing to the bus.
type shippingModule struct {
	shipments          map[string]shipment // keyed by orderID
	nextShipmentNumber int                 // its own counter, independent of Ordering's
}

func NewShippingModule(ctx ModuleContext) (any, error) {
	m := &shippingModule{shipments: map[string]shipment{}, nextShipmentNumber: 1}
	ctx.Bus.Subscribe(func(event OrderPlaced) {
		shipmentID := fmt.Sprintf("ship-%d", m.nextShipmentNumber)
		m.nextShipmentNumber++
		m.shipments[event.OrderID] = shipment{shipmentID, "ready to ship"}
		fmt.Printf("[shipping] shipment %s created for %s\n", shipmentID, event.OrderID)
	})
	return m, nil
}

func (m *shippingModule) StatusFor(orderID string) string {
	if s, ok := m.shipments[orderID]; ok {
		return s.status
	}
	return "unknown"
}

// [/shipping]

// must stops the demo on an unexpected error; the demo has no recovery path.
func must(err error) {
	if err != nil {
		panic(err)
	}
}

// [usage]
func main() {
	bus := &InProcessEventBus{}
	host := NewModuleHost(bus)
	// Registration order is start order; ordering needs catalog, so catalog is registered first.
	// Register returns each API as any; the type assertion gives back the typed interface.
	catalogAPI, err := host.Register("catalog", nil, NewCatalogModule)
	must(err)
	orderingAPI, err := host.Register("ordering", []string{"catalog"}, NewOrderingModule)
	must(err)
	shippingAPI, err := host.Register("shipping", nil, NewShippingModule)
	must(err)
	catalog := catalogAPI.(CatalogAPI)
	ordering := orderingAPI.(OrderingAPI)
	shipping := shippingAPI.(ShippingAPI)
	fmt.Printf("modules started: %s\n", strings.Join(host.Started, ", "))

	// A client outside the monolith talks to the public APIs only.
	placed := ordering.PlaceOrder("cust-42", []OrderLineRequest{
		{"sku-1", 2},
		{"sku-2", 1},
	})
	fmt.Printf("%s placed for cust-42, total %s\n", placed.OrderID, formatCents(placed.TotalCents))

	// Unknown product: a rejected result, not an error. No id is assigned.
	rejected := ordering.PlaceOrder("cust-42", []OrderLineRequest{{"sku-9", 1}})
	fmt.Printf("rejected: %s\n", rejected.Reason)

	// Catalog changes its own price; Ordering kept its own copy of the old one.
	catalog.SetPrice("sku-1", 2499)
	if total, ok := ordering.OrderTotal("order-1"); ok {
		fmt.Printf("order-1 total still %s\n", formatCents(total))
	} else {
		fmt.Println("order-1 total unknown")
	}

	fmt.Printf("shipping status for order-1: %s\n", shipping.StatusFor("order-1"))

	// Shipping never declared catalog, so the host refuses the lookup.
	if _, err := host.Use("shipping", "catalog"); err != nil {
		fmt.Printf("rejected: %s\n", err.Error())
	}
}

// [/usage]
