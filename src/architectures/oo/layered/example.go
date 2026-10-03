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

// [order]
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

type OrderRepository interface {
	Save(order *Order)
}

// [save]
type SqlOrderRepository struct{}

func (r *SqlOrderRepository) Save(order *Order) {
	databaseQuery(fmt.Sprintf("INSERT INTO orders (customer_id, total) VALUES ('%s', %s)",
		order.CustomerID, strconv.FormatFloat(order.Total(), 'f', -1, 64)))
}

// [/save]

// [placeOrder]
type OrderService struct {
	repository OrderRepository
}

func NewOrderService(repository OrderRepository) *OrderService {
	return &OrderService{repository: repository}
}

func (s *OrderService) PlaceOrder(customerID string, items []LineItem) (*Order, error) {
	order := NewOrder(customerID)
	for _, item := range items {
		if err := order.AddLine(item); err != nil {
			return nil, err
		}
	}
	s.repository.Save(order)
	return order, nil
}

// [/placeOrder]

// [controller]
type OrderController struct {
	service *OrderService
}

func NewOrderController(service *OrderService) *OrderController {
	return &OrderController{service: service}
}

func (c *OrderController) HandlePlaceOrder(customerID string, items []LineItem) (int, string, error) {
	order, err := c.service.PlaceOrder(customerID, items)
	if err != nil {
		return 0, "", err
	}
	return 201, order.CustomerID, nil
}

// [violation]
// Anti-pattern: reaching straight past Application and Domain into Data access.
// Nothing in a plain type stops this -- only discipline and code review do.
func (c *OrderController) HandleDebugLookup(id string) []any {
	return databaseQuery(fmt.Sprintf("SELECT * FROM orders WHERE id = '%s'", id))
}

// [/violation]
// [/controller]

func databaseQuery(sql string) []any {
	fmt.Println("SQL: " + sql)
	return nil
}

func main() {
	// Usage
	controller := NewOrderController(NewOrderService(&SqlOrderRepository{}))
	controller.HandlePlaceOrder("cust-42", []LineItem{{"WIDGET", 19.99}, {"GADGET", 29.99}})

	// Anti-pattern in action: the controller reaches past three layers directly into the database.
	controller.HandleDebugLookup("42")
}
