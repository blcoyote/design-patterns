package main

import (
	"errors"
	"fmt"
)

type OrderRequest struct {
	OrderID string
	Sku     string
	Qty     int
	Amount  int
}

// [inventoryService]
type InventoryService struct {
	reserved map[string]bool // orderIDs currently holding a reservation
}

func NewInventoryService() *InventoryService {
	return &InventoryService{reserved: map[string]bool{}}
}

func (s *InventoryService) Reserve(orderID, sku string, qty int) {
	// [reserve]
	s.reserved[orderID] = true
	fmt.Printf("inventory: reserved %dx %s for %s\n", qty, sku, orderID)
	// [/reserve]
}

// [release]
// Compensating transaction for Reserve: undoes the hold so the stock is
// available again. Only ever runs if a later saga step fails.
func (s *InventoryService) Release(orderID string) {
	if s.reserved[orderID] {
		delete(s.reserved, orderID)
		fmt.Printf("inventory: released reservation for %s\n", orderID)
	}
}

// [/release]
// [/inventoryService]

// [paymentService]
type PaymentService struct {
	charged map[string]bool
	// Fault injection for the demo: the next Charge fails, as if the card was declined.
	FailNextCharge bool
}

func NewPaymentService() *PaymentService {
	return &PaymentService{charged: map[string]bool{}}
}

func (s *PaymentService) Charge(orderID string, amount int) error {
	// [charge]
	if s.FailNextCharge {
		s.FailNextCharge = false
		return errors.New("card declined")
	}
	s.charged[orderID] = true
	fmt.Printf("payment: charged %d for %s\n", amount, orderID)
	return nil
	// [/charge]
}

// [refund]
// Compensating transaction for Charge: only meaningful for an order that was
// actually charged, which is why the orchestrator only queues it once
// Charge has succeeded.
func (s *PaymentService) Refund(orderID string) {
	if s.charged[orderID] {
		delete(s.charged, orderID)
		fmt.Printf("payment: refunded %s\n", orderID)
	}
}

// [/refund]
// [/paymentService]

// [shippingService]
type ShippingService struct {
	// Fault injection for the demo: the next Ship fails, as if the carrier rejected the package.
	FailNextShip bool
}

func (s *ShippingService) Ship(orderID string) error {
	// [ship]
	if s.FailNextShip {
		s.FailNextShip = false
		return errors.New("carrier rejected package")
	}
	fmt.Printf("shipping: shipped %s\n", orderID)
	return nil
	// [/ship]
}

// [/shippingService]

// An "undo step N" closure, queued only once step N has actually succeeded.
type Compensation func()

// [orchestrator]
type OrderSagaOrchestrator struct {
	inventory *InventoryService
	payments  *PaymentService
	shipping  *ShippingService
}

func (o *OrderSagaOrchestrator) PlaceOrder(order OrderRequest) {
	var compensations []Compensation
	fmt.Printf("saga: starting order %s\n", order.OrderID)

	// [runSteps]
	o.inventory.Reserve(order.OrderID, order.Sku, order.Qty)
	compensations = append(compensations, func() { o.inventory.Release(order.OrderID) })

	if err := o.payments.Charge(order.OrderID, order.Amount); err != nil {
		o.rollback(order.OrderID, err, compensations)
		return
	}
	compensations = append(compensations, func() { o.payments.Refund(order.OrderID) })

	if err := o.shipping.Ship(order.OrderID); err != nil {
		o.rollback(order.OrderID, err, compensations)
		return
	}
	// [/runSteps]

	fmt.Printf("saga: order %s completed\n", order.OrderID)
}

func (o *OrderSagaOrchestrator) rollback(orderID string, err error, compensations []Compensation) {
	fmt.Printf("saga: step failed (%s), compensating\n", err)
	// [compensate]
	// Undo only the steps that actually completed, in reverse order: the most
	// recently succeeded step is undone first. A step that never ran has no
	// compensation queued, so it is never touched.
	for i := len(compensations) - 1; i >= 0; i-- {
		compensations[i]()
	}
	// [/compensate]
	fmt.Printf("saga: order %s rolled back\n", orderID)
}

// [/orchestrator]

func main() {
	// [client]
	inventory := NewInventoryService()
	payments := NewPaymentService()
	shipping := &ShippingService{}
	saga := &OrderSagaOrchestrator{inventory, payments, shipping}

	saga.PlaceOrder(OrderRequest{"A1", "WIDGET", 2, 50})
	// saga: starting order A1
	// inventory: reserved 2x WIDGET for A1
	// payment: charged 50 for A1
	// shipping: shipped A1
	// saga: order A1 completed

	payments.FailNextCharge = true // the card is declined this time
	saga.PlaceOrder(OrderRequest{"A2", "WIDGET", 1, 25})
	// saga: starting order A2
	// inventory: reserved 1x WIDGET for A2
	// saga: step failed (card declined), compensating
	// inventory: released reservation for A2
	// saga: order A2 rolled back

	shipping.FailNextShip = true // reserve and charge succeed, but the carrier rejects it
	saga.PlaceOrder(OrderRequest{"A3", "WIDGET", 3, 75})
	// saga: starting order A3
	// inventory: reserved 3x WIDGET for A3
	// payment: charged 75 for A3
	// saga: step failed (carrier rejected package), compensating
	// payment: refunded A3
	// inventory: released reservation for A3
	// saga: order A3 rolled back
	// [/client]
}
