package main

import (
	"fmt"
	"strings"
)

// [button]
type Button interface {
	Render() string
}

// [/button]

// [checkbox]
type Checkbox interface {
	Render() string
}

// [/checkbox]

// [uiFactory]
type UIFactory interface {
	CreateButton() Button
	CreateCheckbox() Checkbox
}

// [/uiFactory]

// [lightFactory]
type LightButton struct{}

func (LightButton) Render() string { return "button [light]" }

type LightCheckbox struct{}

func (LightCheckbox) Render() string { return "checkbox [light]" }

type LightFactory struct{}

func (LightFactory) CreateButton() Button     { return LightButton{} }
func (LightFactory) CreateCheckbox() Checkbox { return LightCheckbox{} }

// [/lightFactory]

// [darkFactory]
type DarkButton struct{}

func (DarkButton) Render() string { return "button [dark]" }

type DarkCheckbox struct{}

func (DarkCheckbox) Render() string { return "checkbox [dark]" }

type DarkFactory struct{}

func (DarkFactory) CreateButton() Button     { return DarkButton{} }
func (DarkFactory) CreateCheckbox() Checkbox { return DarkCheckbox{} }

// [/darkFactory]

// show prints a slice the way the Python example does: ['a', 'b'].
func show(items []string) {
	fmt.Println("['" + strings.Join(items, "', '") + "']")
}

// Usage
// [usage]
func main() {
	// [client]
	renderDialog := func(factory UIFactory) []string {
		button := factory.CreateButton()
		checkbox := factory.CreateCheckbox()
		return []string{button.Render(), checkbox.Render()}
	}
	// [/client]

	getUserTheme := func() string {
		return "dark" // stand-in for a real preference lookup
	}

	theme := getUserTheme()
	var factory UIFactory = LightFactory{}
	if theme == "dark" {
		factory = DarkFactory{}
	}

	show(renderDialog(factory)) // ['button [dark]', 'checkbox [dark]']

	// Switch the whole family just by swapping the factory:
	show(renderDialog(LightFactory{})) // ['button [light]', 'checkbox [light]']
}

// [/usage]
