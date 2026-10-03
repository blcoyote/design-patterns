package main

import "fmt"

// [command]
type Command interface {
	Execute() bool
	Undo(wasOn bool)
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

// [onCommand]
type LightOnCommand struct {
	light *Light
}

func NewLightOnCommand(light *Light) *LightOnCommand {
	return &LightOnCommand{light: light}
}

func (c *LightOnCommand) Execute() bool {
	wasOn := c.light.On()
	c.light.TurnOn()
	return wasOn
}

func (c *LightOnCommand) Undo(wasOn bool) {
	if !wasOn {
		c.light.TurnOff()
	}
}

// [/onCommand]

// [offCommand]
type LightOffCommand struct {
	light *Light
}

func NewLightOffCommand(light *Light) *LightOffCommand {
	return &LightOffCommand{light: light}
}

func (c *LightOffCommand) Execute() bool {
	wasOn := c.light.On()
	c.light.TurnOff()
	return wasOn
}

func (c *LightOffCommand) Undo(wasOn bool) {
	if wasOn {
		c.light.TurnOn()
	}
}

// [/offCommand]

// [remote]
type RemoteButton struct {
	current Command
	history []ExecutedCommand
}

type ExecutedCommand struct {
	command Command
	wasOn   bool
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
	r.history = append(r.history, ExecutedCommand{
		command: r.current,
		wasOn:   r.current.Execute(),
	})
}

// [/execute]

// [undo]
func (r *RemoteButton) UndoLast() {
	if len(r.history) == 0 {
		return
	}
	executed := r.history[len(r.history)-1]
	r.history = r.history[:len(r.history)-1]
	executed.command.Undo(executed.wasOn)
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
