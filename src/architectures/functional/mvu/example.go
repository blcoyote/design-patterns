package main

import (
	"fmt"
	"slices"
	"strings"
)

// [model]
// The entire application state, as one immutable-by-convention value. Nothing outside
// update() mutates a Model -- update() builds a new one (cloning the todos slice) and
// returns it. Go has no way to enforce immutability, so this is a convention.
type Todo struct {
	ID   int
	Text string
	Done bool
}

type Model struct {
	Todos     []Todo
	NextID    int
	LastSaved *int // nil means "none yet"
}

// [/model]

// [msg]
// Messages are data describing intent, not method calls -- the Command pattern's
// "encapsulate a request as an object" taken to its logical extreme. The client
// never calls a method on the model; it builds one of these and dispatches it.
// Go has no sum types, so Msg is an interface closed by an unexported marker method.
type Msg interface{ isMsg() }

type Add struct{ Text string }
type Toggle struct{ ID int }
type Saved struct{ ID int }

func (Add) isMsg()    {}
func (Toggle) isMsg() {}
func (Saved) isMsg()  {}

// A Cmd is likewise a description of an effect to perform, not the effect itself.
// update() never touches the outside world -- it only ever returns Cmds for the
// runtime to carry out.
type Cmd interface{ isCmd() }

type Save struct{ ID int }

func (Save) isCmd() {}

// [/msg]

// [update]
// update is the pure core: (model, msg) -> (model, cmds). Same inputs, same outputs,
// forever. No I/O, no randomness, no clock -- an explicit state machine (every Msg maps
// to exactly one transition) with the transition function made a first-class value.
func update(model Model, msg Msg) (Model, []Cmd) {
	switch m := msg.(type) {
	case Add:
		todo := Todo{ID: model.NextID, Text: m.Text, Done: false}
		next := Model{
			Todos:     append(slices.Clone(model.Todos), todo),
			NextID:    model.NextID + 1,
			LastSaved: model.LastSaved,
		}
		return next, []Cmd{Save{ID: todo.ID}}
	case Toggle:
		todos := slices.Clone(model.Todos)
		for i := range todos {
			if todos[i].ID == m.ID {
				todos[i].Done = !todos[i].Done
			}
		}
		next := model
		next.Todos = todos
		return next, nil
	case Saved:
		next := model
		id := m.ID
		next.LastSaved = &id
		return next, nil
	}
	panic("unknown message")
}

// [/update]

// [view]
// view is the other pure function: model -> rendered text. No I/O -- view() only ever
// builds a string; the runtime decides what to do with it.
func view(model Model) string {
	lines := []string{}
	for _, t := range model.Todos {
		mark := " "
		if t.Done {
			mark = "x"
		}
		lines = append(lines, fmt.Sprintf("[%s] %s", mark, t.Text))
	}
	saved := "saved: none yet"
	if model.LastSaved != nil {
		saved = fmt.Sprintf("saved #%d", *model.LastSaved)
	}
	return strings.Join(append(lines, fmt.Sprintf("(%s)", saved)), "\n")
}

// [/view]

// [runtime]
// Runtime is the imperative shell: a tiny loop that dispatches messages, calls the
// pure update(), keeps every resulting model in history (what makes time-travel
// possible), renders + notifies after every change, and only then performs whatever
// Cmds came back. It is the only part of the program that does anything impure.
type Runtime struct {
	history     []Model
	cursor      int
	subscribers []func(rendered string)
}

func NewRuntime(initial Model) *Runtime {
	return &Runtime{history: []Model{initial}, cursor: 0}
}

func (r *Runtime) Model() Model { return r.history[r.cursor] }

func (r *Runtime) HistoryLength() int { return len(r.history) }

func (r *Runtime) Subscribe(fn func(rendered string)) {
	r.subscribers = append(r.subscribers, fn)
}

func (r *Runtime) Dispatch(msg Msg) {
	next, cmds := update(r.Model(), msg)
	// A dispatch after time-travel discards any history past the current cursor --
	// an undo-stack policy chosen for this demo (Redux DevTools keeps the later actions).
	r.history = append(slices.Clone(r.history[:r.cursor+1]), next)
	r.cursor = len(r.history) - 1
	r.notify()
	for _, cmd := range cmds {
		r.perform(cmd)
	}
}

// perform is the interpreter: walks each returned Cmd and performs the matching effect.
func (r *Runtime) perform(cmd Cmd) {
	switch c := cmd.(type) {
	case Save:
		// A simulated save effect: synchronous and deterministic for this demo,
		// but in a real app this would be a network call whose result arrives later.
		r.Dispatch(Saved{ID: c.ID})
	}
}

// TimeTravel steps back to an earlier model without re-running update -- pure time-travel.
func (r *Runtime) TimeTravel(index int) {
	r.cursor = index
	r.notify()
}

func (r *Runtime) notify() {
	rendered := view(r.Model())
	for _, sub := range r.subscribers {
		sub(rendered)
	}
}

// [/runtime]

// [usage]
func main() {
	runtime := NewRuntime(Model{Todos: nil, NextID: 1, LastSaved: nil})
	runtime.Subscribe(func(rendered string) { fmt.Println("--- view ---\n" + rendered) })

	runtime.Dispatch(Add{Text: "Buy milk"})
	runtime.Dispatch(Toggle{ID: 1})

	fmt.Println("history length:", runtime.HistoryLength())

	runtime.TimeTravel(0)
}

// [/usage]
