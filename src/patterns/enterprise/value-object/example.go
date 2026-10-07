package main

import (
	"errors"
	"fmt"
)

// [money]
// A value object: it has no identity, only its amount and currency. The fields
// are unexported and there are no setters, and methods take a copy, so a Money
// never changes after creation. (Unexported fields only guard other packages;
// inside this package the discipline is by convention.)
// The amount is a whole number of cents, so there is no floating-point rounding.
type Money struct {
	amount   int
	currency string
}

// [moneyCreate]
// The only way in, so an invalid Money can never exist.
func NewMoney(amount int, currency string) (Money, error) {
	if amount < 0 {
		return Money{}, errors.New("amount must be a non-negative whole number of cents")
	}
	if len(currency) != 3 {
		return Money{}, fmt.Errorf("invalid currency %s", currency)
	}
	for _, c := range currency {
		if c < 'A' || c > 'Z' {
			return Money{}, fmt.Errorf("invalid currency %s", currency)
		}
	}
	return Money{amount, currency}, nil
}

// [/moneyCreate]

// [moneyAdd]
// Returns a new Money. Neither operand changes.
func (m Money) Add(other Money) (Money, error) {
	if other.currency != m.currency {
		return Money{}, fmt.Errorf("cannot add %s to %s", other.currency, m.currency)
	}
	return Money{m.amount + other.amount, m.currency}, nil
}

// [/moneyAdd]

// [moneyEquals]
// Equal by value: == already compares every field, so the same amount and
// currency are equal, whichever copy holds them. Equals just gives it a name.
func (m Money) Equals(other Money) bool {
	return m == other
}

// [/moneyEquals]

func (m Money) String() string {
	return fmt.Sprintf("%d.%02d %s", m.amount/100, m.amount%100, m.currency)
}

// [/money]

// [orderId]
// A strongly typed id. OrderID and CustomerID are different types, so the
// compiler rejects one where the other is expected. Named string types
// compare by value with ==.
type OrderID string

func NewOrderID(value string) (OrderID, error) {
	if value == "" {
		return "", errors.New("order id must not be empty")
	}
	return OrderID(value), nil
}

// [/orderId]

// [customerId]
type CustomerID string

func NewCustomerID(value string) (CustomerID, error) {
	if value == "" {
		return "", errors.New("customer id must not be empty")
	}
	return CustomerID(value), nil
}

// [/customerId]

// [order]
// An entity: identified by its id, not by its attributes. Its total is a value object.
type Order struct {
	ID       OrderID
	Customer CustomerID
	Total    Money
}

// [/order]

func main() {
	// [client]
	price, _ := NewMoney(1000, "EUR")
	shipping, _ := NewMoney(250, "EUR")
	total, _ := price.Add(shipping)
	fmt.Printf("price %s, total %s\n", price, total)
	// price 10.00 EUR, total 12.50 EUR
	expected, _ := NewMoney(1250, "EUR")
	fmt.Printf("equal by value: %t\n", total.Equals(expected))
	// equal by value: true

	if _, err := NewMoney(-5, "EUR"); err != nil {
		fmt.Printf("rejected: %s\n", err)
	}
	// rejected: amount must be a non-negative whole number of cents
	usd, _ := NewMoney(100, "USD")
	if _, err := price.Add(usd); err != nil {
		fmt.Printf("rejected: %s\n", err)
	}
	// rejected: cannot add USD to EUR

	orderID, _ := NewOrderID("o-1")
	customerID, _ := NewCustomerID("c-1")
	order := Order{ID: orderID, Customer: customerID, Total: total}
	fmt.Printf("order %s for %s, total %s\n", order.ID, order.Customer, order.Total)
	// order o-1 for c-1, total 12.50 EUR
	// Order{ID: customerID, ...} // does not compile: CustomerID is not an OrderID
	again, _ := NewOrderID("o-1")
	fmt.Printf("same id: %t\n", order.ID == again)
	// same id: true
	// [/client]
}
