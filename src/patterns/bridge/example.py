from typing import Protocol


# [device]
class Device(Protocol):
    is_on: bool
    volume: int

    def turn_on(self) -> None: ...
    def turn_off(self) -> None: ...
    def set_volume(self, percent: int) -> None: ...
# [/device]


# [tv]
class TV:
    def __init__(self) -> None:
        self.is_on = False
        self.volume = 30

    def turn_on(self) -> None:
        self.is_on = True
        print('tv: on')

    def turn_off(self) -> None:
        self.is_on = False
        print('tv: off')

    def set_volume(self, percent: int) -> None:
        self.volume = percent
        print(f'tv: volume {percent}%')
# [/tv]


# [radio]
class Radio:
    def __init__(self) -> None:
        self.is_on = False
        self.volume = 30

    def turn_on(self) -> None:
        self.is_on = True
        print('radio: on')

    def turn_off(self) -> None:
        self.is_on = False
        print('radio: off')

    def set_volume(self, percent: int) -> None:
        self.volume = percent
        print(f'radio: volume {percent}%')
# [/radio]


# [remoteControl]
class RemoteControl:
    # [holds]
    def __init__(self, device: Device) -> None:
        self.device = device
    # [/holds]

    # [togglePower]
    def toggle_power(self) -> None:
        if self.device.is_on:
            self.device.turn_off()
        else:
            self.device.turn_on()
    # [/togglePower]

    # [setDevice]
    def set_device(self, device: Device) -> None:
        self.device = device
    # [/setDevice]
# [/remoteControl]


# [advancedRemote]
class AdvancedRemoteControl(RemoteControl):
    # [mute]
    def mute(self) -> None:
        self.device.set_volume(0)
    # [/mute]
# [/advancedRemote]


# [usage]
# Usage
remote = RemoteControl(TV())
remote.toggle_power()  # tv: on

remote.set_device(Radio())
remote.toggle_power()  # radio: on

advanced = AdvancedRemoteControl(TV())
advanced.toggle_power()  # tv: on
advanced.mute()  # tv: volume 0%
# [/usage]
