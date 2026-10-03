package main

import "fmt"

// [mediatorIface]
// A marker type every widget satisfies, so the mediator can accept
// "some colleague" without depending on any concrete widget type.
type Colleague interface{}

type Mediator interface {
	Notify(sender Colleague, event string)
}

// [/mediatorIface]

// [dialog]
type LoginDialog struct {
	// [holds]
	// Exposed as plain exported fields so a caller can drive the demo
	// widgets directly (dialog.Username.Type(...)) — the dialog still
	// owns construction and wiring, which is all Mediator actually requires.
	Username *UsernameField
	Password *PasswordField
	Checkbox *RememberMeCheckbox
	Submit   *SubmitButton
	// [/holds]
}

func NewLoginDialog() *LoginDialog {
	d := &LoginDialog{}
	d.Username = &UsernameField{mediator: d}
	d.Password = &PasswordField{mediator: d}
	d.Checkbox = &RememberMeCheckbox{mediator: d}
	d.Submit = &SubmitButton{mediator: d}
	return d
}

// [notify]
func (d *LoginDialog) Notify(sender Colleague, event string) {
	if sender == Colleague(d.Username) && event == "changed" {
		// [enable]
		d.Submit.SetEnabled(len(d.Username.Value) > 0)
		// [/enable]
	}
	if sender == Colleague(d.Checkbox) && event == "toggled" {
		// [focus]
		if d.Checkbox.Checked {
			d.Password.Focus()
		}
		// [/focus]
	}
}

// [/notify]
// [/dialog]

// [username]
type UsernameField struct {
	Value    string
	mediator Mediator
}

func (u *UsernameField) Type(value string) {
	u.Value = value
	u.mediator.Notify(u, "changed")
}

// [/username]

// [password]
type PasswordField struct {
	mediator Mediator
}

func (p *PasswordField) Focus() {
	fmt.Println("password: focused")
}

// [/password]

// [checkbox]
type RememberMeCheckbox struct {
	Checked  bool
	mediator Mediator
}

func (c *RememberMeCheckbox) Toggle() {
	c.Checked = !c.Checked
	c.mediator.Notify(c, "toggled")
}

// [/checkbox]

// [submit]
type SubmitButton struct {
	Enabled  bool
	mediator Mediator
}

func (s *SubmitButton) SetEnabled(enabled bool) {
	s.Enabled = enabled
	fmt.Printf("submit: enabled = %t\n", enabled)
}

// [/submit]

func main() {
	// [usage]
	// Usage — widgets are only ever handed the mediator, never each other
	dialog := NewLoginDialog()

	dialog.Username.Type("ada") // submit: enabled = true
	dialog.Checkbox.Toggle()    // password: focused
	// [/usage]
}
