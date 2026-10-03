# [amplifier]
class Amplifier:
    def on(self) -> None:
        print("amp: on")

    def set_volume(self, level: int) -> None:
        print(f"amp: volume {level}")
# [/amplifier]


# [dvdPlayer]
class DvdPlayer:
    def play(self, movie: str) -> None:
        print(f"dvd: playing {movie}")
# [/dvdPlayer]


# [projector]
class Projector:
    def on(self) -> None:
        print("projector: on")

    def wide_screen_mode(self) -> None:
        print("projector: widescreen")
# [/projector]


# [screen]
class Screen:
    def down(self) -> None:
        print("screen: down")
# [/screen]


# [facade]
class HomeTheaterFacade:
    # The facade builds its own subsystem instances by default, so the client
    # never has to know they exist — but a caller that already has one (for
    # testing, or to reuse an existing amplifier) can still inject it.
    def __init__(
        self,
        amp: Amplifier | None = None,
        dvd: DvdPlayer | None = None,
        projector: Projector | None = None,
        screen: Screen | None = None,
    ) -> None:
        self._amp = amp if amp is not None else Amplifier()
        self._dvd = dvd if dvd is not None else DvdPlayer()
        self._projector = projector if projector is not None else Projector()
        self._screen = screen if screen is not None else Screen()

    # [watchMovie]
    def watch_movie(self, movie: str) -> None:
        self._screen.down()
        self._projector.on()
        self._projector.wide_screen_mode()
        self._amp.on()
        self._amp.set_volume(5)
        self._dvd.play(movie)
    # [/watchMovie]
# [/facade]


# [usage]
# Usage
facade = HomeTheaterFacade()

facade.watch_movie("Inception")
# [/usage]
