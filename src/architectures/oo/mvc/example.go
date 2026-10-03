package main

import (
	"fmt"
	"slices"
	"strings"
)

// [model]
// Observer interface: Views register themselves and are notified on every Model change.
type TodoView interface {
	Update(model *TodoModel)
}

type Todo struct {
	ID   int
	Text string
	Done bool
}

type TodoModel struct {
	todos     []*Todo
	observers []TodoView
	nextID    int
}

func NewTodoModel() *TodoModel {
	return &TodoModel{nextID: 1}
}

func (m *TodoModel) Subscribe(view TodoView) {
	m.observers = append(m.observers, view)
}

func (m *TodoModel) AddTodo(text string) {
	m.todos = append(m.todos, &Todo{ID: m.nextID, Text: text})
	m.nextID++
	m.notify()
}

func (m *TodoModel) ToggleTodo(id int) error {
	for _, t := range m.todos {
		if t.ID == id {
			t.Done = !t.Done
			m.notify()
			return nil
		}
	}
	return fmt.Errorf("no such todo: %d", id)
}

func (m *TodoModel) All() []*Todo {
	return m.todos
}

func (m *TodoModel) Remaining() int {
	remaining := 0
	for _, t := range m.todos {
		if !t.Done {
			remaining++
		}
	}
	return remaining
}

func (m *TodoModel) notify() {
	// Notify a snapshot of observers, not the live slice, so a view that subscribes
	// or unsubscribes while handling an update can never skip or double-fire another.
	for _, observer := range slices.Clone(m.observers) {
		observer.Update(m)
	}
}

// [/model]

// [command]
// Command reifies a user action so the Controller can execute it uniformly.
type Command interface {
	Execute(model *TodoModel) error
}

type AddTodoCommand struct {
	text string
}

func (c *AddTodoCommand) Execute(model *TodoModel) error {
	model.AddTodo(c.text)
	return nil
}

type ToggleTodoCommand struct {
	todoID int
}

func (c *ToggleTodoCommand) Execute(model *TodoModel) error {
	return model.ToggleTodo(c.todoID)
}

// [/command]

// [controller]
// Strategy: the interface TodoListView depends on. The View is typed against
// this, not against TodoController, so any implementation can be swapped in.
type TodoInputController interface {
	HandleAddClick(text string) error
	HandleToggleClick(todoID int) error
}

// TodoController translates raw input into a Command run against the Model.
// It satisfies TodoInputController implicitly (Go interfaces need no
// "implements"), so a different implementation would handle the same click
// differently without the View changing at all.
type TodoController struct {
	model *TodoModel
}

func NewTodoController(model *TodoModel) *TodoController {
	return &TodoController{model: model}
}

func (c *TodoController) HandleAddClick(text string) error {
	return (&AddTodoCommand{text: text}).Execute(c.model)
}

func (c *TodoController) HandleToggleClick(todoID int) error {
	return (&ToggleTodoCommand{todoID: todoID}).Execute(c.model)
}

// [/controller]

// Composite: the shared component interface both the leaf and the composite
// implement, so TodoListView can treat every child uniformly through Render().
type Renderable interface {
	Render() string
}

// [itemView]
// TodoItemView is the Composite leaf: one rendered row, reached only through Renderable.
type TodoItemView struct {
	todo *Todo
}

func (v *TodoItemView) Render() string {
	mark := " "
	if v.todo.Done {
		mark = "x"
	}
	return "[" + mark + "] " + v.todo.Text
}

// [/itemView]

// [listView]
// TodoListView is a View + Observer, and the Composite: it holds a Renderable per
// todo and implements the same interface, so Render() can join its children
// without caring that each one happens to be a TodoItemView.
type TodoListView struct {
	// Strategy: the View depends only on the TodoInputController interface, so any
	// implementation can be swapped in without the View changing.
	Controller TodoInputController
	children   []Renderable
}

func (v *TodoListView) Update(model *TodoModel) {
	v.children = nil
	for _, t := range model.All() {
		v.children = append(v.children, &TodoItemView{todo: t})
	}
	fmt.Println("[list] " + v.Render())
}

func (v *TodoListView) Render() string {
	if len(v.children) == 0 {
		return "(empty)"
	}
	parts := make([]string, len(v.children))
	for i, child := range v.children {
		parts[i] = child.Render()
	}
	return strings.Join(parts, ", ")
}

func (v *TodoListView) ClickAdd(text string) error {
	return v.Controller.HandleAddClick(text)
}

func (v *TodoListView) ClickToggle(todoID int) error {
	return v.Controller.HandleToggleClick(todoID)
}

// [/listView]

// [countView]
// RemainingCountView is a second View subscribed to the same Model (Observer):
// proof two Views can watch one Model.
type RemainingCountView struct{}

func (v *RemainingCountView) Update(model *TodoModel) {
	fmt.Printf("[count] %d remaining\n", model.Remaining())
}

// [/countView]

// [usage]
func main() {
	model := NewTodoModel()
	controller := NewTodoController(model)

	listView := &TodoListView{}
	listView.Controller = controller
	countView := &RemainingCountView{}

	model.Subscribe(listView)
	model.Subscribe(countView)

	listView.ClickAdd("Buy milk")
	listView.ClickToggle(1)
}

// [/usage]
