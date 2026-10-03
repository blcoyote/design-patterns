from typing import Protocol


# [command]
class Command(Protocol):
    def execute(self) -> None: ...
    def undo(self) -> None: ...
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
        # What undo() needs: whether the light was already on before execute()
        # ran. Undo can't just assume "the opposite action" is correct.
        self._was_on = False

    def execute(self) -> None:
        self._was_on = self._light.on
        self._light.turn_on()

    def undo(self) -> None:
        if not self._was_on:
            self._light.turn_off()
# [/onCommand]


# [offCommand]
class LightOffCommand:
    def __init__(self, light: Light) -> None:
        self._light = light
        self._was_on = False

    def execute(self) -> None:
        self._was_on = self._light.on
        self._light.turn_off()

    def undo(self) -> None:
        if self._was_on:
            self._light.turn_on()
# [/offCommand]


# [remote]
class RemoteButton:
    def __init__(self) -> None:
        self._current: Command | None = None
        self._history: list[Command] = []

    # [setCommand]
    def set_command(self, command: Command) -> None:
        self._current = command
    # [/setCommand]

    # [execute]
    def press(self) -> None:
        if self._current is None:
            return
        self._current.execute()
        self._history.append(self._current)
    # [/execute]

    # [undo]
    def undo_last(self) -> None:
        if not self._history:
            return
        command = self._history.pop()
        command.undo()
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
