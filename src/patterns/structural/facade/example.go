package main

import "fmt"

// [amplifier]
type Amplifier struct{}

func (a *Amplifier) On() {
	fmt.Println("amp: on")
}

func (a *Amplifier) SetVolume(level int) {
	fmt.Printf("amp: volume %d\n", level)
}

// [/amplifier]

// [dvdPlayer]
type DvdPlayer struct{}

func (d *DvdPlayer) Play(movie string) {
	fmt.Printf("dvd: playing %s\n", movie)
}

// [/dvdPlayer]

// [projector]
type Projector struct{}

func (p *Projector) On() {
	fmt.Println("projector: on")
}

func (p *Projector) WideScreenMode() {
	fmt.Println("projector: widescreen")
}

// [/projector]

// [screen]
type Screen struct{}

func (s *Screen) Down() {
	fmt.Println("screen: down")
}

// [/screen]

// [facade]
type HomeTheaterFacade struct {
	amp       *Amplifier
	dvd       *DvdPlayer
	projector *Projector
	screen    *Screen
}

// The facade builds its own subsystem instances by default, so the client
// never has to know they exist — but a caller that already has one (for
// testing, or to reuse an existing amplifier) can still inject it: pass nil
// for any subsystem the facade should create itself.
func NewHomeTheaterFacade(amp *Amplifier, dvd *DvdPlayer, projector *Projector, screen *Screen) *HomeTheaterFacade {
	if amp == nil {
		amp = &Amplifier{}
	}
	if dvd == nil {
		dvd = &DvdPlayer{}
	}
	if projector == nil {
		projector = &Projector{}
	}
	if screen == nil {
		screen = &Screen{}
	}
	return &HomeTheaterFacade{amp: amp, dvd: dvd, projector: projector, screen: screen}
}

// [watchMovie]
func (f *HomeTheaterFacade) WatchMovie(movie string) {
	f.screen.Down()
	f.projector.On()
	f.projector.WideScreenMode()
	f.amp.On()
	f.amp.SetVolume(5)
	f.dvd.Play(movie)
}

// [/watchMovie]

// [/facade]

// [usage]
func main() {
	facade := NewHomeTheaterFacade(nil, nil, nil, nil)

	facade.WatchMovie("Inception")
}

// [/usage]
