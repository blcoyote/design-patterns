package main

import "fmt"

// [device]
type Device interface {
	IsOn() bool
	Volume() int
	TurnOn()
	TurnOff()
	SetVolume(percent int)
}

// [/device]

// [tv]
type TV struct {
	isOn   bool
	volume int
}

func NewTV() *TV { return &TV{volume: 30} }

func (t *TV) IsOn() bool  { return t.isOn }
func (t *TV) Volume() int { return t.volume }
func (t *TV) TurnOn() {
	t.isOn = true
	fmt.Println("tv: on")
}
func (t *TV) TurnOff() {
	t.isOn = false
	fmt.Println("tv: off")
}
func (t *TV) SetVolume(percent int) {
	t.volume = percent
	fmt.Printf("tv: volume %d%%\n", percent)
}

// [/tv]

// [radio]
type Radio struct {
	isOn   bool
	volume int
}

func NewRadio() *Radio { return &Radio{volume: 30} }

func (r *Radio) IsOn() bool  { return r.isOn }
func (r *Radio) Volume() int { return r.volume }
func (r *Radio) TurnOn() {
	r.isOn = true
	fmt.Println("radio: on")
}
func (r *Radio) TurnOff() {
	r.isOn = false
	fmt.Println("radio: off")
}
func (r *Radio) SetVolume(percent int) {
	r.volume = percent
	fmt.Printf("radio: volume %d%%\n", percent)
}

// [/radio]

// [remoteControl]
type RemoteControl struct {
	// [holds]
	device Device // the bridge: an interface reference to the implementation side
	// [/holds]
}

func NewRemoteControl(device Device) *RemoteControl {
	return &RemoteControl{device: device}
}

// [togglePower]
func (r *RemoteControl) TogglePower() {
	if r.device.IsOn() {
		r.device.TurnOff()
	} else {
		r.device.TurnOn()
	}
}

// [/togglePower]

// [setDevice]
func (r *RemoteControl) SetDevice(device Device) {
	r.device = device
}

// [/setDevice]

// [/remoteControl]

// [advancedRemote]
// Go has no inheritance: embedding RemoteControl promotes its methods and
// gives AdvancedRemoteControl access to the same device field.
type AdvancedRemoteControl struct {
	*RemoteControl
}

func NewAdvancedRemoteControl(device Device) *AdvancedRemoteControl {
	return &AdvancedRemoteControl{NewRemoteControl(device)}
}

// [mute]
func (a *AdvancedRemoteControl) Mute() {
	a.device.SetVolume(0)
}

// [/mute]

// [/advancedRemote]

// [usage]
func main() {
	remote := NewRemoteControl(NewTV())
	remote.TogglePower() // tv: on

	remote.SetDevice(NewRadio())
	remote.TogglePower() // radio: on

	advanced := NewAdvancedRemoteControl(NewTV())
	advanced.TogglePower() // tv: on
	advanced.Mute()        // tv: volume 0%
}

// [/usage]
