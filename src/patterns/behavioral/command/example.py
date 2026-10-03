from typing import Callable, Protocol


# [command]
class Command(Protocol):
    def execute(self) -> Callable[[], None]: ...
# [/command]


# [light]
class Light:
    def __init__(self) -> None:
        self._is_on = False

    @property
    def on(self) -> bool:
        return self._is_on

    def turn_on(self) -> None:
        self._is_on = True
        print("light: on")

    def turn_off(self) -> None:
        self._is_on = False
        print("light: off")
# [/light]


# [onCommand]
class LightOnCommand:
    def __init__(self, light: Light) -> None:
        self._light = light

    def execute(self) -> Callable[[], None]:
        was_on = self._light.on
        self._light.turn_on()
        def undo() -> None:
            if not was_on:
                self._light.turn_off()
        return undo
# [/onCommand]


# [offCommand]
class LightOffCommand:
    def __init__(self, light: Light) -> None:
        self._light = light

    def execute(self) -> Callable[[], None]:
        was_on = self._light.on
        self._light.turn_off()
        def undo() -> None:
            if was_on:
                self._light.turn_on()
        return undo
# [/offCommand]


# [remote]
class RemoteButton:
    def __init__(self) -> None:
        self._current: Command | None = None
        self._history: list[Callable[[], None]] = []

    # [setCommand]
    def set_command(self, command: Command) -> None:
        self._current = command
    # [/setCommand]

    # [execute]
    def press(self) -> None:
        if self._current is None:
            return
        self._history.append(self._current.execute())
    # [/execute]

    # [undo]
    def undo_last(self) -> None:
        if not self._history:
            return
        undo = self._history.pop()
        undo()
    # [/undo]
# [/remote]


# Usage
# [createCommands]
light = Light()
on = LightOnCommand(light)
off = LightOffCommand(light)
# [/createCommands]

remote = RemoteButton()

remote.set_command(on)
remote.press()  # light turns on, pushed onto history

remote.set_command(off)
remote.press()  # light turns off, pushed onto history

remote.undo_last()  # pops LightOffCommand, calls undo() -> light turns back on
