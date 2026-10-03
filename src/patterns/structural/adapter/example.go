package main

import (
	"fmt"
	"math"
)

// [paymentProcessor]
type PaymentProcessor interface {
	Charge(amount float64) string
}

// [/paymentProcessor]

type ChargeResult struct {
	Ok    bool
	Cents int
}

// [adaptee]
type LegacyStripeGateway struct{}

// [chargeCents]
func (g *LegacyStripeGateway) ChargeCents(cents int) ChargeResult {
	fmt.Printf("legacy gateway: charging %d¢\n", cents)
	return ChargeResult{Ok: true, Cents: cents}
}

// [/chargeCents]

// [/adaptee]

// [adapter]
// Object adapter: the adaptee is a field (composition). Go satisfies
// PaymentProcessor implicitly, so there is no "implements" declaration.
type StripeAdapter struct {
	gateway *LegacyStripeGateway // lower-case field: clients only ever talk to the adapter
}

// [charge]
func (a *StripeAdapter) Charge(amount float64) string {
	// math.Round rounds halves away from zero, like JS Math.round for positive amounts.
	cents := int(math.Round(amount * 100))
	result := a.gateway.ChargeCents(cents)
	if result.Ok {
		return fmt.Sprintf("charged $%.2f", float64(result.Cents)/100)
	}
	return "failed"
}

// [/charge]

// [/adapter]

// [usage]
func checkout(processor PaymentProcessor, amount float64) {
	fmt.Println(processor.Charge(amount))
}

func main() {
	checkout(&StripeAdapter{gateway: &LegacyStripeGateway{}}, 4.5)
}

// [/usage]
