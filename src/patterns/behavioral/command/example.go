package main

import "fmt"

// [command]
type Command interface {
	Execute()
	Undo()
}

// [/command]

// [light]
type Light struct {
	isOn bool
}

func (l *Light) On() bool {
	return l.isOn
}

func (l *Light) TurnOn() {
	l.isOn = true
	fmt.Println("light: on")
}

func (l *Light) TurnOff() {
	l.isOn = false
	fmt.Println("light: off")
}

// [/light]

// popLast removes and returns the most recently saved state.
func popLast(states *[]bool) bool {
	last := (*states)[len(*states)-1]
	*states = (*states)[:len(*states)-1]
	return last
}

// [onCommand]
type LightOnCommand struct {
	light    *Light
	previous []bool // one saved state per Execute(): the same command can be pressed again before undo
}

func NewLightOnCommand(light *Light) *LightOnCommand {
	return &LightOnCommand{light: light}
}

func (c *LightOnCommand) Execute() {
	c.previous = append(c.previous, c.light.On()) // remember what Execute() is about to overwrite
	c.light.TurnOn()
}

func (c *LightOnCommand) Undo() {
	wasOn := popLast(&c.previous)
	if !wasOn {
		c.light.TurnOff()
	}
}

// [/onCommand]

// [offCommand]
type LightOffCommand struct {
	light    *Light
	previous []bool // one saved state per Execute(): the same command can be pressed again before undo
}

func NewLightOffCommand(light *Light) *LightOffCommand {
	return &LightOffCommand{light: light}
}

func (c *LightOffCommand) Execute() {
	c.previous = append(c.previous, c.light.On()) // remember what Execute() is about to overwrite
	c.light.TurnOff()
}

func (c *LightOffCommand) Undo() {
	wasOn := popLast(&c.previous)
	if wasOn {
		c.light.TurnOn()
	}
}

// [/offCommand]

// [remote]
type RemoteButton struct {
	current Command
	history []Command
}

// [setCommand]
func (r *RemoteButton) SetCommand(command Command) {
	r.current = command
}

// [/setCommand]

// [execute]
func (r *RemoteButton) Press() {
	if r.current == nil {
		return
	}
	r.current.Execute()
	r.history = append(r.history, r.current)
}

// [/execute]

// [undo]
func (r *RemoteButton) UndoLast() {
	if len(r.history) == 0 {
		return
	}
	command := r.history[len(r.history)-1]
	r.history = r.history[:len(r.history)-1]
	command.Undo()
}

// [/undo]
// [/remote]

func main() {
	// [createCommands]
	light := &Light{}
	on := NewLightOnCommand(light)
	off := NewLightOffCommand(light)
	// [/createCommands]

	remote := &RemoteButton{}

	remote.SetCommand(on)
	remote.Press() // light turns on, pushed onto history

	remote.SetCommand(off)
	remote.Press() // light turns off, pushed onto history

	remote.UndoLast() // pops LightOffCommand, calls Undo() -> light turns back on
}
