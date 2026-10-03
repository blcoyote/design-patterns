package main

import "fmt"

// [transport]
type Transport interface {
	Deliver() string
}

// [/transport]

// [truck]
type Truck struct{}

func (Truck) Deliver() string { return "Delivering by road in a truck" }

// [/truck]

// [ship]
type Ship struct{}

func (Ship) Deliver() string { return "Delivering by sea in a ship" }

// [/ship]

// [logistics]
// Go has no abstract classes or method overriding, so the Creator is an
// interface holding the factory method, and the shared logic is a function
// that takes any Logistics (an embedded base struct could not call back into
// the "subclass" method).
type Logistics interface {
	// The factory method: implementers decide what this returns.
	CreateTransport() Transport
}

// Shared logic that relies on CreateTransport() without knowing the concrete type.
func PlanDelivery(l Logistics) string {
	transport := l.CreateTransport()
	return "Planned. " + transport.Deliver()
}

// [/logistics]

// [roadLogistics]
type RoadLogistics struct{}

func (RoadLogistics) CreateTransport() Transport { return Truck{} }

// [/roadLogistics]

// [seaLogistics]
type SeaLogistics struct{}

func (SeaLogistics) CreateTransport() Transport { return Ship{} }

// [/seaLogistics]

// Usage
// [usage]
func main() {
	runDelivery := func(logistics Logistics) {
		fmt.Println(PlanDelivery(logistics))
	}

	runDelivery(RoadLogistics{}) // "Planned. Delivering by road in a truck"
	runDelivery(SeaLogistics{})  // "Planned. Delivering by sea in a ship"
}

// [/usage]
