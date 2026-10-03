package main

// Go shortcut: a plain func(from, to string) Route could serve as a strategy.
// We keep an explicit interface so the GoF roles stay visible.

type Route struct {
	Minutes int
	Summary string
}

// [routeStrategy]
type RouteStrategy interface {
	Calculate(from, to string) Route
}

// [/routeStrategy]

// [fastest]
type FastestRoute struct{}

func (FastestRoute) Calculate(from, to string) Route {
	return Route{Minutes: 12, Summary: "highway from " + from + " to " + to}
}

// [/fastest]

// [shortest]
type ShortestRoute struct{}

func (ShortestRoute) Calculate(from, to string) Route {
	return Route{Minutes: 18, Summary: "direct path from " + from + " to " + to}
}

// [/shortest]

// [scenic]
type ScenicRoute struct{}

func (ScenicRoute) Calculate(from, to string) Route {
	return Route{Minutes: 35, Summary: "coastal road from " + from + " to " + to}
}

// [/scenic]

// [navigator]
type Navigator struct {
	// [holds]
	strategy RouteStrategy
	// [/holds]
}

// [setStrategy]
func (n *Navigator) SetStrategy(strategy RouteStrategy) {
	n.strategy = strategy
}

// [/setStrategy]

// [route]
func (n *Navigator) Route(from, to string) Route {
	return n.strategy.Calculate(from, to)
}

// [/route]
// [/navigator]

func main() {
	nav := &Navigator{strategy: FastestRoute{}}
	nav.Route("Home", "Office") // Route{Minutes: 12, ...}

	nav.SetStrategy(ScenicRoute{})
	nav.Route("Home", "Office") // Route{Minutes: 35, ...} — same call, different algorithm

	nav.SetStrategy(ShortestRoute{})
	nav.Route("Home", "Office") // Route{Minutes: 18, ...}
}
