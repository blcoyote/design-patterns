// [device]
interface Device {
  isOn: boolean;
  volume: number;
  turnOn(): void;
  turnOff(): void;
  setVolume(percent: number): void;
}
// [/device]

// [tv]
class TV implements Device {
  isOn = false;
  volume = 30;

  turnOn() {
    this.isOn = true;
    console.log("tv: on");
  }
  turnOff() {
    this.isOn = false;
    console.log("tv: off");
  }
  setVolume(percent: number) {
    this.volume = percent;
    console.log(`tv: volume ${percent}%`);
  }
}
// [/tv]

// [radio]
class Radio implements Device {
  isOn = false;
  volume = 30;

  turnOn() {
    this.isOn = true;
    console.log("radio: on");
  }
  turnOff() {
    this.isOn = false;
    console.log("radio: off");
  }
  setVolume(percent: number) {
    this.volume = percent;
    console.log(`radio: volume ${percent}%`);
  }
}
// [/radio]

// [remoteControl]
class RemoteControl {
  // [holds]
  constructor(protected device: Device) {}
  // [/holds]

  // [togglePower]
  togglePower() {
    if (this.device.isOn) this.device.turnOff();
    else this.device.turnOn();
  }
  // [/togglePower]

  // [setDevice]
  setDevice(device: Device) {
    this.device = device;
  }
  // [/setDevice]
}
// [/remoteControl]

// [advancedRemote]
class AdvancedRemoteControl extends RemoteControl {
  // [mute]
  mute() {
    this.device.setVolume(0);
  }
  // [/mute]
}
// [/advancedRemote]

// [usage]
// Usage
const remote = new RemoteControl(new TV());
remote.togglePower(); // tv: on

remote.setDevice(new Radio());
remote.togglePower(); // radio: on

const advanced = new AdvancedRemoteControl(new TV());
advanced.togglePower(); // tv: on
advanced.mute(); // tv: volume 0%
// [/usage]
