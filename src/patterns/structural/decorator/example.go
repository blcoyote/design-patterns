package main

import "fmt"

// [coffee]
type Coffee interface {
	Cost() float64
	Description() string
}

// [/coffee]

// [simpleCoffee]
type SimpleCoffee struct{}

func (SimpleCoffee) Cost() float64       { return 2.0 }
func (SimpleCoffee) Description() string { return "Coffee" }

// [/simpleCoffee]

// [coffeeDecorator]
// Go has no abstract classes or super: the base decorator simply forwards to
// the wrapped Coffee, and concrete decorators embed it and call it explicitly.
type CoffeeDecorator struct {
	coffee Coffee
}

func (d *CoffeeDecorator) Cost() float64       { return d.coffee.Cost() }
func (d *CoffeeDecorator) Description() string { return d.coffee.Description() }

// [/coffeeDecorator]

// [milkDecorator]
type MilkDecorator struct {
	CoffeeDecorator
}

func NewMilkDecorator(coffee Coffee) *MilkDecorator {
	return &MilkDecorator{CoffeeDecorator{coffee}}
}

func (m *MilkDecorator) Cost() float64 {
	return m.CoffeeDecorator.Cost() + 0.5
}

func (m *MilkDecorator) Description() string {
	return m.CoffeeDecorator.Description() + " + milk"
}

// [/milkDecorator]

// [sugarDecorator]
type SugarDecorator struct {
	CoffeeDecorator
}

func NewSugarDecorator(coffee Coffee) *SugarDecorator {
	return &SugarDecorator{CoffeeDecorator{coffee}}
}

func (s *SugarDecorator) Cost() float64 {
	return s.CoffeeDecorator.Cost() + 0.25
}

func (s *SugarDecorator) Description() string {
	return s.CoffeeDecorator.Description() + " + sugar"
}

// [/sugarDecorator]

// [usage]
func main() {
	var order Coffee = SimpleCoffee{}
	order = NewMilkDecorator(order)
	order = NewSugarDecorator(order)

	fmt.Println(order.Description(), order.Cost()) // "Coffee + milk + sugar" 2.75
}

// [/usage]
