// [amplifier]
class Amplifier {
  on() {
    console.log("amp: on");
  }
  setVolume(level: number) {
    console.log(`amp: volume ${level}`);
  }
}
// [/amplifier]

// [dvdPlayer]
class DvdPlayer {
  play(movie: string) {
    console.log(`dvd: playing ${movie}`);
  }
}
// [/dvdPlayer]

// [projector]
class Projector {
  on() {
    console.log("projector: on");
  }
  wideScreenMode() {
    console.log("projector: widescreen");
  }
}
// [/projector]

// [screen]
class Screen {
  down() {
    console.log("screen: down");
  }
}
// [/screen]

// [facade]
class HomeTheaterFacade {
  private amp: Amplifier;
  private dvd: DvdPlayer;
  private projector: Projector;
  private screen: Screen;

  // The facade builds its own subsystem instances by default, so the client
  // never has to know they exist — but a caller that already has one (for
  // testing, or to reuse an existing amplifier) can still inject it.
  constructor(
    amp = new Amplifier(),
    dvd = new DvdPlayer(),
    projector = new Projector(),
    screen = new Screen(),
  ) {
    this.amp = amp;
    this.dvd = dvd;
    this.projector = projector;
    this.screen = screen;
  }

  // [watchMovie]
  watchMovie(movie: string) {
    this.screen.down();
    this.projector.on();
    this.projector.wideScreenMode();
    this.amp.on();
    this.amp.setVolume(5);
    this.dvd.play(movie);
  }
  // [/watchMovie]
}
// [/facade]

// [usage]
// Usage
const facade = new HomeTheaterFacade();

facade.watchMovie("Inception");
// [/usage]
