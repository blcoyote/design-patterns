package main

import "fmt"

// [style]
type Style struct {
	Color     string
	LineWidth float64
}

func (s *Style) Clone() *Style {
	return &Style{Color: s.Color, LineWidth: s.LineWidth}
}

// [/style]

// [prototype]
// Go interfaces cannot declare fields, so the style is exposed through a getter.
// Clone returns the Shape interface (Go has no covariant return types).
type Shape interface {
	GetStyle() *Style
	Clone() Shape
}

// [/prototype]

// [circle]
type Circle struct {
	Radius float64
	Style  *Style
}

func (c *Circle) GetStyle() *Style { return c.Style }

// [circleClone]
func (c *Circle) Clone() Shape {
	// Deep copy: a fresh Style, not a shared pointer to the original's.
	return &Circle{Radius: c.Radius, Style: c.Style.Clone()}
}

// [/circleClone]
// [/circle]

// [rectangle]
type Rectangle struct {
	Width  float64
	Height float64
	Style  *Style
}

func (r *Rectangle) GetStyle() *Style { return r.Style }

// [rectangleClone]
func (r *Rectangle) Clone() Shape {
	return &Rectangle{Width: r.Width, Height: r.Height, Style: r.Style.Clone()}
}

// [/rectangleClone]
// [/rectangle]

// [registry]
type ShapeRegistry struct {
	// [holds]
	prototypes map[string]Shape
	// [/holds]
}

func NewShapeRegistry() *ShapeRegistry {
	return &ShapeRegistry{prototypes: map[string]Shape{}}
}

// [seed]
func (r *ShapeRegistry) Register(key string, prototype Shape) {
	r.prototypes[key] = prototype
}

// [/seed]

// [registryClone]
func (r *ShapeRegistry) Clone(key string) Shape {
	prototype, ok := r.prototypes[key]
	if !ok {
		panic(fmt.Sprintf("Unknown prototype: %s", key)) // like throw / raise in the other languages
	}
	return prototype.Clone()
}

// [/registryClone]
// [/registry]

// Usage
// [usage]
func main() {
	registry := NewShapeRegistry()
	registry.Register("circle", &Circle{Radius: 5, Style: &Style{Color: "black", LineWidth: 1}})
	registry.Register("rectangle", &Rectangle{Width: 10, Height: 20, Style: &Style{Color: "blue", LineWidth: 2}})

	myCircle := registry.Clone("circle")
	myCircle.GetStyle().Color = "red" // safe through the Shape interface alone: style is its own deep copy
	myCircle.(*Circle).Radius = 50    // a shape-specific tweak still needs the concrete type

	myRect := registry.Clone("rectangle").(*Rectangle)
	myRect.Width = 100
}

// [/usage]
