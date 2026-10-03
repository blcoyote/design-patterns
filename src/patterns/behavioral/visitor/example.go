package main

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Go has no method overloading, so the double dispatch uses distinct method
// names (VisitCircle, VisitRectangle, VisitGroup) on the visitor interface.

// [element]
type Shape interface {
	Accept(visitor ShapeVisitor)
}

// [/element]

// [visitor]
type ShapeVisitor interface {
	VisitCircle(circle *Circle)
	VisitRectangle(rectangle *Rectangle)
	VisitGroup(group *Group)
}

// [/visitor]

// [circle]
type Circle struct {
	Radius float64
}

func (c *Circle) Accept(visitor ShapeVisitor) {
	// [visitCircleMethod]
	visitor.VisitCircle(c) // hop 2: dispatches on the visitor's own type
	// [/visitCircleMethod]
}

// [/circle]

// [rectangle]
type Rectangle struct {
	Width, Height float64
}

func (r *Rectangle) Accept(visitor ShapeVisitor) {
	// [visitRectangleMethod]
	visitor.VisitRectangle(r)
	// [/visitRectangleMethod]
}

// [/rectangle]

// [group]
type Group struct {
	children []Shape
}

func (g *Group) Add(shape Shape) {
	g.children = append(g.children, shape)
}

func (g *Group) ChildCount() int {
	return len(g.children)
}

// [groupAccept]
func (g *Group) Accept(visitor ShapeVisitor) {
	for _, child := range g.children {
		child.Accept(visitor) // hop 1, per child
	}
	// [visitGroupMethod]
	visitor.VisitGroup(g) // hop 2, for the group itself
	// [/visitGroupMethod]
}

// [/groupAccept]
// [/group]

// [areaCalculator]
type AreaCalculator struct {
	Total float64
}

func (a *AreaCalculator) VisitCircle(circle *Circle) {
	a.Total += math.Pi * math.Pow(circle.Radius, 2)
}

func (a *AreaCalculator) VisitRectangle(rectangle *Rectangle) {
	a.Total += rectangle.Width * rectangle.Height
}

func (a *AreaCalculator) VisitGroup(group *Group) {
	// Children already added themselves in above — nothing left to do here.
}

// [/areaCalculator]

// [jsonExporter]
// jsonNumber prints 2.0 as 2, like JSON.stringify.
func jsonNumber(n float64) string {
	return strconv.FormatFloat(n, 'f', -1, 64)
}

type JsonExporter struct {
	parts []string
}

func (e *JsonExporter) VisitCircle(circle *Circle) {
	e.parts = append(e.parts, `{"type":"circle","r":`+jsonNumber(circle.Radius)+`}`)
}

func (e *JsonExporter) VisitRectangle(rectangle *Rectangle) {
	e.parts = append(e.parts, `{"type":"rectangle","w":`+jsonNumber(rectangle.Width)+`,"h":`+jsonNumber(rectangle.Height)+`}`)
}

func (e *JsonExporter) VisitGroup(group *Group) {
	// Every child (leaf or nested group) left exactly one entry behind, so this
	// group's children are the last ChildCount entries — siblings stay untouched.
	split := len(e.parts) - group.ChildCount()
	children := append([]string(nil), e.parts[split:]...)
	e.parts = e.parts[:split]
	e.parts = append(e.parts, `{"type":"group","children":[`+strings.Join(children, ",")+`]}`)
}

// Result returns the root entry once the whole tree has been visited.
func (e *JsonExporter) Result() string {
	if len(e.parts) == 0 {
		return "{}"
	}
	return e.parts[0]
}

// [/jsonExporter]

func main() {
	// [build]
	circle := &Circle{Radius: 3}
	rectangle := &Rectangle{Width: 4, Height: 3}
	group := &Group{}
	group.Add(circle)
	group.Add(rectangle)
	// [/build]

	// Usage: swap the operation without changing Circle, Rectangle or Group.
	areaCalculator := &AreaCalculator{}
	group.Accept(areaCalculator)
	fmt.Println(areaCalculator.Total) // ≈ 40.27

	exporter := &JsonExporter{}
	group.Accept(exporter)
	fmt.Println(exporter.Result()) // {"type":"group","children":[...]}
}
