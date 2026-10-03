package main

import "fmt"

// [expression]
type Expression interface {
	Interpret(context *Context) float64
}

// [/expression]

// [context]
type Context struct {
	bindings map[string]float64
}

func NewContext(bindings map[string]float64) *Context {
	return &Context{bindings: bindings}
}

func (c *Context) Lookup(name string) float64 {
	value, ok := c.bindings[name]
	// Fail loudly instead of letting an unbound name turn later arithmetic into a silent bug.
	// (Go's counterpart of throwing: panic. Idiomatic Go would often return an error instead.)
	if !ok {
		panic(fmt.Sprintf("Unbound variable: %s", name))
	}
	return value
}

// [/context]

// [number]
type NumberExpression struct {
	value float64
}

func (n *NumberExpression) Interpret(context *Context) float64 {
	// Terminal: no children, so it answers immediately.
	return n.value
}

// [/number]

// [variable]
type VariableExpression struct {
	name string
}

func (v *VariableExpression) Interpret(context *Context) float64 {
	// Also terminal, but it answers by asking the Context instead of itself.
	return context.Lookup(v.name)
}

// [/variable]

// [multiply]
type MultiplyExpression struct {
	left, right Expression
}

func (m *MultiplyExpression) Interpret(context *Context) float64 {
	// Non-terminal: delegate to both children, then combine their answers.
	return m.left.Interpret(context) * m.right.Interpret(context)
}

// [/multiply]

// [add]
type AddExpression struct {
	left, right Expression
}

func (a *AddExpression) Interpret(context *Context) float64 {
	return a.left.Interpret(context) + a.right.Interpret(context)
}

// [/add]

func main() {
	// [usage]
	// [build]
	// x + (2 * 3)
	var tree Expression = &AddExpression{
		&VariableExpression{"x"},
		&MultiplyExpression{&NumberExpression{2}, &NumberExpression{3}},
	}
	// [/build]

	// [newContext]
	context := NewContext(map[string]float64{"x": 5})
	// [/newContext]

	fmt.Println(tree.Interpret(context)) // 11
	// [/usage]
}
